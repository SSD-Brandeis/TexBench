# TexBench

TexBench is a local chat + form interface for designing Tectonic workload specs,
editing them in a builder, and benchmarking them against multiple local database engines
with `tectonic-cli`.

## Quickstart

### 1. Use a GPU-backed machine

The local assistant uses Ollama with `llama3:latest`. TexBench can technically
run on a CPU-only machine, but the assistant will be too slow for a good
interactive demo or day-to-day workflow. On CPU-only machines, expect slow
responses and frequent Ollama request timeouts.

### 2. Install the basic prerequisites

Make sure these are available before the first run:

- `curl`
- `tar`
- `make`
- `python3` for Cassandra's `cqlsh`
- internet access for first-time downloads

Ollama's current official macOS support starts at macOS 14+. See the official
docs if you need platform-specific Ollama setup notes:

- [Ollama macOS docs](https://docs.ollama.com/macos)
- [Ollama Linux docs](https://docs.ollama.com/linux)

### 3. Start TexBench

From the repo root, run:

```bash
make
```

The first run may take a while. It bootstraps the local runtime, downloads the
pinned model and matching `tectonic-cli` binary, installs or starts the local
services TexBench needs, then starts the app.

When it finishes, open:

[http://127.0.0.1:8787](http://127.0.0.1:8787)

Use `Ctrl+C` in the terminal to stop TexBench. If `make` started Cassandra,
Redis, or Ollama for this session, it will stop the session-managed processes on
exit.

### 4. Create and run a workload

In the browser, use the preset flow or the assistant to create a workload spec,
review the generated structure in the builder, then run it against one of the
supported local database targets.

Supported database targets in the UI:

- `rocksdb`
- `cassandra`
- `scylla`
- `redis`
- `printdb`

For Cassandra and Redis runs, the default local targets are:

```text
127.0.0.1:9042
127.0.0.1:6379
```

Benchmark artifacts are written under:

- `generated-workloads/latest-spec.json`
- `generated-workloads/latest-benchmark-output.txt`
- `generated-workloads/runs/<run_id>/`

## What `make` Does

`make` will:

- detect your OS and CPU automatically
- reuse a working local Node.js, Java, Ollama, `tectonic-cli`, Cassandra, or
  Redis setup when it already satisfies the pinned requirements
- otherwise bootstrap a repo-local Node.js runtime
- otherwise bootstrap a repo-local Java 17 runtime for Cassandra when a
  compatible Cassandra setup is not already available
- install npm dependencies
- install Ollama if it is missing
- install Cassandra `5.0.7` if it is missing
- install Redis with Homebrew on macOS or the detected Linux package manager if
  it is missing
- start Cassandra for the current app session if it is not already running and
  functional on `127.0.0.1:9042`
- verify Cassandra with `cqlsh`
- start Redis for the current app session if it is not already running and
  functional on `127.0.0.1:6379`
- verify Redis with `redis-cli PING`
- start Ollama for the current app session if it is not already running
- pull the pinned default local model (`llama3:latest`)
- verify that Ollama resolves it to digest `365c0bd3c000`
- download the matching prebuilt `tectonic-cli` release asset for your platform
- start the app on [http://127.0.0.1:8787](http://127.0.0.1:8787)

## Advanced

### Supported Platforms

The bootstrap path currently targets:

- macOS `arm64`
- Linux `x86_64`
- Linux `arm64`

You can inspect the resolved platform and bootstrap asset selection with:

```bash
make bootstrap-info
```

### Bootstrap Requirements

The default bootstrap path expects:

- a GPU-backed machine for practical local Ollama latency
- `curl`
- `tar`
- `make`
- `python3` for `cqlsh`
- a C compiler and `pkg-config` only if Redis cannot be installed with Homebrew
  or the detected Linux package manager and the repo-local source-build fallback
  is needed
- internet access for first-time downloads

### Runtime Defaults

`make` starts the app with:

- `AI_PROVIDER=ollama`
- `OLLAMA_MODEL=llama3:latest`
- `OLLAMA_TIMEOUT_MS=300000`
- `AI_TIMEOUT_MS=300000`
- `TECTONIC_BIN=<repo-local prebuilt binary>`
- Cassandra pinned to `5.0.7` on `127.0.0.1:9042`
- Redis on `127.0.0.1:6379`

The app server entrypoint remains:

```bash
node src/server.mjs
```

If you want to run the app manually after bootstrapping tools yourself, that
still works.

### Development

If you already have Node installed and want the traditional local dev flow:

```bash
npm install
AI_PROVIDER=ollama OLLAMA_MODEL=llama3:latest npm run dev
```

The repo-local bootstrap scripts live in
[scripts/bootstrap-lib.sh](scripts/bootstrap-lib.sh) and
[scripts/run-local-dev.sh](scripts/run-local-dev.sh).

### Tests

Run the full local test suite:

```bash
npm test
```

Run the demo-oriented Ollama coverage:

```bash
make test-demo
```

### Maintainer: Prebuilt `tectonic-cli` Assets

End users do not need a local Rust or Tectonic checkout. `make` downloads
platform-specific `tectonic-cli` release assets from this repo's GitHub
releases.

Asset naming convention:

```text
tectonic-cli-v<version>-darwin-arm64.tar.gz
tectonic-cli-v<version>-darwin-x64.tar.gz
tectonic-cli-v<version>-linux-arm64.tar.gz
tectonic-cli-v<version>-linux-x64.tar.gz
```

To package the current platform locally:

```bash
make package-tectonic
```

If `TECTONIC_SOURCE_DIR` is not set, the packaging script clones a managed
Tectonic checkout into `.bootstrap/src/Tectonic`, fetches
[SSD-Brandeis/Tectonic](https://github.com/SSD-Brandeis/Tectonic), and switches
it to branch `no-marker-array`.

To attempt the full platform matrix from macOS:

```bash
make package-tectonic-all
```

That target runs
[scripts/package-tectonic-cli.sh](scripts/package-tectonic-cli.sh), which builds
the Tectonic workspace with all currently available features enabled and then
packages the resulting `tectonic-cli` binary:

```bash
cargo build --release --all-features
```

The managed Tectonic branch currently requires nightly Rust, so the packaging
flow installs and uses the pinned `BOOTSTRAP_TECTONIC_RUST_TOOLCHAIN` value
`nightly` by default for both host and Docker builds.

For multi-platform packaging, the script maps the repo bootstrap platforms to
Rust targets:

- `darwin-arm64` -> `aarch64-apple-darwin`
- `darwin-x64` -> `x86_64-apple-darwin`
- `linux-arm64` -> `aarch64-unknown-linux-gnu`
- `linux-x64` -> `x86_64-unknown-linux-gnu`

Packaging strategy:

- macOS targets build on the macOS host with target-specific SDK/linker flags.
- On macOS, the packaging script prefers `brew --prefix cassandra-cpp-driver`
  for `CASSANDRA_SYS_LIB_PATH` when that formula is installed.
- On Apple Silicon macOS hosts, `darwin-x64` is skipped by default because the
  required x86_64 Cassandra/OpenSSL native dependencies are typically not
  present. `make package-tectonic-all` therefore produces `darwin-arm64`,
  `linux-arm64`, and `linux-x64` on those hosts unless you build the Intel macOS
  artifact on an actual Intel Mac.
- Linux targets build in Docker buildx using
  [docker/tectonic-cli-linux-builder.Dockerfile](docker/tectonic-cli-linux-builder.Dockerfile),
  which installs the native RocksDB and Cassandra driver prerequisites inside
  the builder image.
- The Linux builder defaults to conservative parallelism (`CPP_BUILD_JOBS=2`,
  `CARGO_BUILD_JOBS=2`) to avoid memory-pressure failures during the Cassandra
  driver compile. Override with `BOOTSTRAP_TECTONIC_DOCKER_CPP_JOBS` and
  `BOOTSTRAP_TECTONIC_DOCKER_CARGO_JOBS` if your machine can handle more.
- `make package-tectonic-all` therefore expects Docker buildx to be available
  when run on macOS.
- If a packaged target already exists in `dist/`, the script skips rebuilding
  it. Set `PACKAGE_FORCE=1` to rebuild anyway.

You can override the platform list with:

```bash
PACKAGE_PLATFORMS=darwin-arm64,linux-x64 make package-tectonic
```

If Cassandra libraries live outside the default linker path, set
`CASSANDRA_SYS_LIB_PATH` before packaging. On Apple Silicon macOS, that often
means:

```bash
export CASSANDRA_SYS_LIB_PATH=/opt/homebrew/lib
make package-tectonic
```

For platform-specific overrides, use env vars like:

```bash
export CASSANDRA_SYS_LIB_PATH_DARWIN_ARM64=/opt/homebrew/lib
export CASSANDRA_SYS_LIB_PATH_DARWIN_X64=/usr/local/lib
```

Packaged artifacts are written to:

```text
dist/
```

Those tarballs should then be uploaded to the GitHub release tag configured by
the bootstrap scripts.
