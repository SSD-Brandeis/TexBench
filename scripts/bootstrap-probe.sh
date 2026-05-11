#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/bootstrap-lib.sh"

key="${1:-}"

node_bin="$(bootstrap_existing_node_bin || true)"
npm_bin="$(bootstrap_existing_npm_bin || true)"
java_bin="$(bootstrap_existing_java_bin || true)"
tectonic_bin="$(bootstrap_existing_tectonic_bin || true)"
cassandra_bin="$(bootstrap_existing_cassandra_bin || true)"
cqlsh_bin="$(bootstrap_existing_cqlsh_bin || true)"
redis_server_bin="$(bootstrap_existing_redis_server_bin || true)"
redis_cli_bin="$(bootstrap_existing_redis_cli_bin || true)"
ollama_bin="$(bootstrap_existing_ollama_bin || true)"
curl_bin="$(bootstrap_existing_curl_bin || true)"

case "$key" in
  node-source)
    if [ -n "$node_bin" ] && [ -n "$npm_bin" ]; then
      printf 'existing\n'
    else
      printf 'bootstrap\n'
    fi
    ;;
  node-path)
    if [ -n "$node_bin" ] && [ -n "$npm_bin" ]; then
      printf '%s\n' "$node_bin"
    else
      bootstrap_node_bin
    fi
    ;;
  tectonic-source)
    if [ -n "$tectonic_bin" ]; then
      printf 'existing\n'
    else
      printf 'bootstrap\n'
    fi
    ;;
  tectonic-path)
    if [ -n "$tectonic_bin" ]; then
      printf '%s\n' "$tectonic_bin"
    else
      bootstrap_tectonic_bin
    fi
    ;;
  java-source)
    if [ -n "$java_bin" ]; then
      printf 'existing\n'
    else
      printf 'bootstrap\n'
    fi
    ;;
  java-path)
    if [ -n "$java_bin" ]; then
      printf '%s\n' "$java_bin"
    else
      bootstrap_java_bin
    fi
    ;;
  cassandra-source)
    if [ -n "$cassandra_bin" ] && [ -n "$cqlsh_bin" ]; then
      printf 'existing\n'
    else
      printf 'bootstrap\n'
    fi
    ;;
  cassandra-path)
    if [ -n "$cassandra_bin" ]; then
      printf '%s\n' "$cassandra_bin"
    else
      bootstrap_cassandra_bin
    fi
    ;;
  cqlsh-path)
    if [ -n "$cqlsh_bin" ]; then
      printf '%s\n' "$cqlsh_bin"
    else
      bootstrap_cqlsh_bin
    fi
    ;;
  redis-source)
    if [ -n "$redis_server_bin" ] && [ -n "$redis_cli_bin" ]; then
      printf 'existing\n'
    else
      printf 'bootstrap\n'
    fi
    ;;
  redis-server-path)
    if [ -n "$redis_server_bin" ]; then
      printf '%s\n' "$redis_server_bin"
    else
      bootstrap_redis_server_bin
    fi
    ;;
  redis-cli-path)
    if [ -n "$redis_cli_bin" ]; then
      printf '%s\n' "$redis_cli_bin"
    else
      bootstrap_redis_cli_bin
    fi
    ;;
  ollama-source)
    if [ -n "$ollama_bin" ]; then
      printf 'existing\n'
    else
      printf 'install\n'
    fi
    ;;
  ollama-path)
    printf '%s\n' "$ollama_bin"
    ;;
  curl-source)
    if [ -n "$curl_bin" ]; then
      printf 'existing\n'
    else
      printf 'install\n'
    fi
    ;;
  curl-path)
    printf '%s\n' "$curl_bin"
    ;;
  *)
    cat >&2 <<'EOF'
Usage: scripts/bootstrap-probe.sh <key>

Keys:
  node-source
  node-path
  java-source
  java-path
  tectonic-source
  tectonic-path
  cassandra-source
  cassandra-path
  cqlsh-path
  redis-source
  redis-server-path
  redis-cli-path
  ollama-source
  ollama-path
  curl-source
  curl-path
EOF
    exit 1
    ;;
esac
