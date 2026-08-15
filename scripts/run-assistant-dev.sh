#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_LOCAL_DEV_SOURCE_ONLY=1 source "$SCRIPT_DIR/run-local-dev.sh"

main() {
  bootstrap_parse_local_dev_args "$@"
  bootstrap_require_commands tar
  bootstrap_ensure_core_download_tooling
  bootstrap_select_node_runtime
  bootstrap_install_npm_dependencies
  bootstrap_install_ollama_if_missing
  bootstrap_start_ollama_for_session
  bootstrap_ensure_ollama_models

  bootstrap_log "Starting development app on 0.0.0.0:8787"
  PATH="$(dirname "$BOOTSTRAP_NODE_BIN"):$PATH" \
    AI_PROVIDER=ollama \
    OLLAMA_MODEL="$BOOTSTRAP_OLLAMA_MODEL" \
    OLLAMA_HOST="$BOOTSTRAP_OLLAMA_HOST" \
    OLLAMA_BASE_URL="$BOOTSTRAP_OLLAMA_BASE_URL" \
    OLLAMA_TIMEOUT_MS="${OLLAMA_TIMEOUT_MS:-300000}" \
    AI_TIMEOUT_MS="${AI_TIMEOUT_MS:-300000}" \
    "$BOOTSTRAP_NODE_BIN" "$BOOTSTRAP_REPO_ROOT/src/server.mjs"
}

main "$@"
