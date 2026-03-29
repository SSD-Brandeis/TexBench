#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/bootstrap-lib.sh"

key="${1:-}"

case "$key" in
  platform) printf '%s\n' "$BOOTSTRAP_PLATFORM" ;;
  node-version) printf '%s\n' "$BOOTSTRAP_NODE_VERSION" ;;
  java-version) printf '%s\n' "$BOOTSTRAP_JAVA_VERSION" ;;
  node-archive) bootstrap_node_archive_name ;;
  node-url) bootstrap_node_archive_url ;;
  node-bin) bootstrap_node_bin ;;
  rust-target) bootstrap_rust_target "${BOOTSTRAP_TARGET_PLATFORM:-$BOOTSTRAP_PLATFORM}" ;;
  package-strategy) bootstrap_package_strategy "${BOOTSTRAP_TARGET_PLATFORM:-$BOOTSTRAP_PLATFORM}" "${BOOTSTRAP_HOST_PLATFORM:-$BOOTSTRAP_PLATFORM}" ;;
  docker-platform) bootstrap_docker_platform "${BOOTSTRAP_TARGET_PLATFORM:-$BOOTSTRAP_PLATFORM}" ;;
  tectonic-version) printf '%s\n' "$BOOTSTRAP_TECTONIC_CLI_VERSION" ;;
  tectonic-asset) bootstrap_tectonic_asset_name "${BOOTSTRAP_TARGET_PLATFORM:-$BOOTSTRAP_PLATFORM}" ;;
  tectonic-url) bootstrap_tectonic_asset_url "${BOOTSTRAP_TARGET_PLATFORM:-$BOOTSTRAP_PLATFORM}" ;;
  tectonic-bin) bootstrap_tectonic_bin "${BOOTSTRAP_TARGET_PLATFORM:-$BOOTSTRAP_PLATFORM}" ;;
  tectonic-repository-url) printf '%s\n' "$BOOTSTRAP_TECTONIC_REPOSITORY_URL" ;;
  tectonic-branch) printf '%s\n' "$BOOTSTRAP_TECTONIC_BRANCH" ;;
  tectonic-managed-dir) printf '%s\n' "$BOOTSTRAP_TECTONIC_MANAGED_DIR" ;;
  tectonic-rust-toolchain) printf '%s\n' "$BOOTSTRAP_TECTONIC_RUST_TOOLCHAIN" ;;
  tectonic-docker-rust-image) printf '%s\n' "$BOOTSTRAP_TECTONIC_DOCKER_RUST_IMAGE" ;;
  tectonic-docker-cpp-jobs) printf '%s\n' "$BOOTSTRAP_TECTONIC_DOCKER_CPP_JOBS" ;;
  tectonic-docker-cargo-jobs) printf '%s\n' "$BOOTSTRAP_TECTONIC_DOCKER_CARGO_JOBS" ;;
  cassandra-cpp-driver-ref) printf '%s\n' "$BOOTSTRAP_CASSANDRA_CPP_DRIVER_REF" ;;
  ollama-version) printf '%s\n' "$BOOTSTRAP_OLLAMA_VERSION" ;;
  ollama-model) printf '%s\n' "$BOOTSTRAP_OLLAMA_MODEL" ;;
  ollama-digest) printf '%s\n' "$BOOTSTRAP_OLLAMA_MODEL_DIGEST" ;;
  cassandra-version) printf '%s\n' "$BOOTSTRAP_CASSANDRA_VERSION" ;;
  cassandra-url) bootstrap_cassandra_archive_url ;;
  cassandra-sys-lib-path) bootstrap_default_cassandra_sys_lib_path ;;
  *)
    cat >&2 <<'EOF'
Usage: scripts/bootstrap-info.sh <key>

Keys:
  platform
  node-version
  java-version
  node-archive
  node-url
  node-bin
  rust-target
  package-strategy
  docker-platform
  tectonic-version
  tectonic-asset
  tectonic-url
  tectonic-bin
  tectonic-repository-url
  tectonic-branch
  tectonic-managed-dir
  tectonic-rust-toolchain
  tectonic-docker-rust-image
  tectonic-docker-cpp-jobs
  tectonic-docker-cargo-jobs
  cassandra-cpp-driver-ref
  ollama-version
  ollama-model
  ollama-digest
  cassandra-version
  cassandra-url
  cassandra-sys-lib-path
EOF
    exit 1
    ;;
esac
