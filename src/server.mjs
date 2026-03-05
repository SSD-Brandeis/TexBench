import http from 'node:http';
import path from 'node:path';
import { Readable } from 'node:stream';
import { createReadStream, promises as fs } from 'node:fs';

import workerEntrypoint from './index.js';
import { createOpenAiCompatibleBindingFromEnv } from './openai-ai-binding.mjs';
import { createCloudflareAiBindingFromEnv } from './cloudflare-ai-binding.mjs';
import { getLocalRunnerConfig, handleWorkloadRequest, stopActiveRuns } from './local-tectonic-runner.mjs';

const HOST = readString(process.env.APP_HOST || process.env.LOCAL_APP_HOST) || '127.0.0.1';
const PORT = readInteger(process.env.APP_PORT || process.env.PORT, 8787);
const PUBLIC_DIR = path.resolve(process.env.PUBLIC_DIR || path.join(process.cwd(), 'public'));
const MAX_REQUEST_BYTES = readInteger(process.env.MAX_REQUEST_BYTES, 2 * 1024 * 1024);
const SHUTDOWN_FORCE_EXIT_MS = readInteger(process.env.SHUTDOWN_FORCE_EXIT_MS, 5000);

const aiProviderPreference = readString(process.env.AI_PROVIDER).toLowerCase() || 'auto';
const cloudflareAiBinding = createCloudflareAiBindingFromEnv(process.env);
const openAiBinding = createOpenAiCompatibleBindingFromEnv(process.env);
const aiSelection = selectAiProvider(aiProviderPreference, cloudflareAiBinding, openAiBinding, process.env);
const localAiBinding = aiSelection.binding;
const workerEnv = buildWorkerEnv(process.env, localAiBinding, aiSelection.error_code, aiSelection.provider);

const server = http.createServer(async (req, res) => {
  try {
    await routeRequest(req, res);
  } catch (error) {
    console.error('Server unhandled error:', error);
    sendJson(res, 500, {
      error: 'Unhandled server error.',
      code: 'server_unhandled_error'
    });
  }
});

server.on('error', (error) => {
  console.error(buildListenErrorMessage(error, HOST, PORT));
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const workload = getLocalRunnerConfig();
  console.log('Local app server listening on http://' + HOST + ':' + PORT);
  console.log('Serving static files from:', PUBLIC_DIR);
  console.log('Workload output directory:', workload.known_output_dir);
  console.log('tectonic-cli binary:', workload.tectonic_bin);
  if (localAiBinding) {
    console.log('AI mode:', aiSelection.provider + ' enabled.');
  } else {
    console.log('AI mode: disabled (' + aiSelection.error_code + '). /api/assist will return a runtime error.');
  }
});

let shutdownPromise = null;

process.once('SIGINT', () => {
  void requestShutdown('SIGINT');
});

process.once('SIGTERM', () => {
  void requestShutdown('SIGTERM');
});

function requestShutdown(signal) {
  if (!shutdownPromise) {
    shutdownPromise = shutdown(signal);
    return shutdownPromise;
  }
  console.log('Received ' + signal + ', shutdown already in progress...');
  return shutdownPromise;
}

async function shutdown(signal) {
  console.log('Received ' + signal + ', stopping local app server...');
  const forceExitMs = Math.max(500, SHUTDOWN_FORCE_EXIT_MS);
  const forceExitTimer = setTimeout(() => {
    console.error('Shutdown exceeded ' + forceExitMs + 'ms, forcing exit.');
    process.exit(1);
  }, forceExitMs);
  if (typeof forceExitTimer.unref === 'function') {
    forceExitTimer.unref();
  }

  try {
    await stopActiveRuns();
    await new Promise((resolve) => {
      server.close(() => resolve());
      if (typeof server.closeIdleConnections === 'function') {
        server.closeIdleConnections();
      }
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
    });
  } finally {
    clearTimeout(forceExitTimer);
  }

  process.exit(0);
}

async function routeRequest(req, res) {
  const method = String(req.method || 'GET').toUpperCase();
  const host = readString(req.headers.host) || (HOST + ':' + PORT);
  const url = new URL(req.url || '/', 'http://' + host);
  const pathname = normalizePathname(url.pathname);

  if (pathname.startsWith('/api/workloads/')) {
    await handleWorkloadRequest(req, res);
    return;
  }

  if (pathname === '/api/assist') {
    if (method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }
    await handleAssistRequest(req, res, url);
    return;
  }

  if (pathname === '/api/health') {
    const workload = getLocalRunnerConfig();
    sendJson(res, 200, {
      ok: true,
      mode: 'local_macos',
      ai: {
        enabled: !!localAiBinding,
        provider: localAiBinding ? aiSelection.provider : 'unavailable',
        error_code: localAiBinding ? null : aiSelection.error_code
      },
      workload
    });
    return;
  }

  await serveStaticAsset(res, pathname, method);
}

async function handleAssistRequest(req, res, url) {
  const method = String(req.method || 'POST').toUpperCase();
  const body = method === 'GET' || method === 'HEAD'
    ? undefined
    : await readRequestBody(req, MAX_REQUEST_BYTES);
  const headers = new Headers();
  Object.entries(req.headers || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => headers.append(key, entry));
      return;
    }
    if (typeof value === 'string') {
      headers.set(key, value);
    }
  });

  const request = new Request(url.toString(), {
    method,
    headers,
    body
  });

  const response = await workerEntrypoint.fetch(request, workerEnv);
  await sendFetchResponse(res, response);
}

async function sendFetchResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    if (key === 'transfer-encoding' || key === 'connection') {
      return;
    }
    res.setHeader(key, value);
  });

  if (!response.body) {
    res.end();
    return;
  }

  Readable.fromWeb(response.body).pipe(res);
}

async function serveStaticAsset(res, pathname, method) {
  if (method !== 'GET' && method !== 'HEAD') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const requestPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = resolveAssetPath(requestPath);
  if (!filePath) {
    sendJson(res, 403, {
      error: 'Forbidden path.',
      code: 'forbidden_path'
    });
    return;
  }

  let stat = await safeStat(filePath);
  let resolvedPath = filePath;
  if (stat && stat.isDirectory()) {
    resolvedPath = path.join(filePath, 'index.html');
    stat = await safeStat(resolvedPath);
  }

  if (!stat || !stat.isFile()) {
    sendJson(res, 404, {
      error: 'Not found.',
      code: 'not_found'
    });
    return;
  }

  res.statusCode = 200;
  res.setHeader('content-type', inferContentType(resolvedPath));
  res.setHeader('content-length', String(stat.size));
  res.setHeader('cache-control', 'no-store');
  if (method === 'HEAD') {
    res.end();
    return;
  }

  createReadStream(resolvedPath).pipe(res);
}

function resolveAssetPath(requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return null;
  }
  const safePath = decoded.replace(/^\/+/, '');
  const candidate = path.resolve(path.join(PUBLIC_DIR, safePath));
  const allowedPrefix = PUBLIC_DIR.endsWith(path.sep) ? PUBLIC_DIR : (PUBLIC_DIR + path.sep);
  if (candidate !== PUBLIC_DIR && !candidate.startsWith(allowedPrefix)) {
    return null;
  }
  return candidate;
}

async function readRequestBody(req, maxBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > maxBytes) {
      throw new Error('Request body too large.');
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

async function safeStat(filePath) {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

function normalizePathname(pathname) {
  const raw = typeof pathname === 'string' ? pathname : '/';
  return raw.replace(/\/+$/, '') || '/';
}

function buildWorkerEnv(envLike, aiBinding, aiConfigError, resolvedAiProvider) {
  const env = envLike && typeof envLike === 'object' ? envLike : {};
  const providerFromSelection = readString(resolvedAiProvider);
  const providerFromEnv = readString(env.AI_PROVIDER);
  const out = {
    AI_PROVIDER: providerFromSelection || providerFromEnv,
    AI_NAME: readString(env.AI_NAME) || readString(env.OPENAI_MODEL) || '',
    AI_MODELS: readString(env.AI_MODELS) || readString(env.OPENAI_MODEL) || '',
    AI_TEMPERATURE: readString(env.AI_TEMPERATURE) || '0',
    AI_RETRY_ATTEMPTS: readString(env.AI_RETRY_ATTEMPTS) || '2',
    AI_MAX_TOKENS: readString(env.AI_MAX_TOKENS) || '420',
    AI_TIMEOUT_MS: readString(env.AI_TIMEOUT_MS) || '15000',
    ASSETS: {
      fetch: async () => new Response('Not found', { status: 404 })
    }
  };
  if (aiBinding) {
    out.AI = aiBinding;
  } else if (typeof aiConfigError === 'string' && aiConfigError.trim()) {
    out.AI_CONFIG_ERROR = aiConfigError.trim();
  }
  return out;
}

function selectAiProvider(preference, cloudflareBinding, openAiBinding, envLike) {
  const env = envLike && typeof envLike === 'object' ? envLike : {};
  const pref = preference === 'cloudflare' || preference === 'openai' ? preference : 'auto';

  if (pref === 'cloudflare') {
    if (cloudflareBinding) {
      return { binding: cloudflareBinding, provider: 'cloudflare', error_code: null };
    }
    return {
      binding: null,
      provider: 'unavailable',
      error_code: 'cloudflare_ai_credentials_missing'
    };
  }

  if (pref === 'openai') {
    if (openAiBinding) {
      return { binding: openAiBinding, provider: 'openai_compatible', error_code: null };
    }
    return {
      binding: null,
      provider: 'unavailable',
      error_code: 'openai_token_missing'
    };
  }

  if (cloudflareBinding) {
    return { binding: cloudflareBinding, provider: 'cloudflare', error_code: null };
  }
  if (openAiBinding) {
    return { binding: openAiBinding, provider: 'openai_compatible', error_code: null };
  }

  const hasCloudflareCreds = readString(env.CLOUDFLARE_ACCOUNT_ID || env.CF_ACCOUNT_ID)
    || readString(env.CLOUDFLARE_API_TOKEN || env.CF_API_TOKEN);
  if (hasCloudflareCreds) {
    return {
      binding: null,
      provider: 'unavailable',
      error_code: 'cloudflare_ai_credentials_missing'
    };
  }
  if (readString(env.OPENAI_API_KEY)) {
    return {
      binding: null,
      provider: 'unavailable',
      error_code: 'openai_token_missing'
    };
  }
  return {
    binding: null,
    provider: 'unavailable',
    error_code: 'ai_credentials_missing'
  };
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload || {});
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('content-length', String(Buffer.byteLength(body)));
  res.end(body);
}

function inferContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.svg': return 'image/svg+xml';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.ico': return 'image/x-icon';
    case '.txt': return 'text/plain; charset=utf-8';
    default: return 'application/octet-stream';
  }
}

function readString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function readInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildListenErrorMessage(error, host, port) {
  const code = error && typeof error.code === 'string' ? error.code : '';
  const base = 'Local app server failed to listen on http://' + host + ':' + port + '.';
  if (code === 'EADDRINUSE') {
    return base + ' Address already in use. Stop the existing process or change PORT.';
  }
  if (code === 'EACCES' || code === 'EPERM') {
    return base + ' Permission denied. Check local security policy or choose another port.';
  }
  return base + ' ' + (error && error.message ? error.message : 'unknown error');
}
