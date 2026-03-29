#!/usr/bin/env bash

bootstrap_repo_root() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "$script_dir/.." && pwd
}

BOOTSTRAP_REPO_ROOT="${BOOTSTRAP_REPO_ROOT:-$(bootstrap_repo_root)}"
BOOTSTRAP_ROOT="${BOOTSTRAP_ROOT:-$BOOTSTRAP_REPO_ROOT/.bootstrap}"
BOOTSTRAP_CACHE_DIR="${BOOTSTRAP_CACHE_DIR:-$BOOTSTRAP_ROOT/cache}"
BOOTSTRAP_RUN_DIR="${BOOTSTRAP_RUN_DIR:-$BOOTSTRAP_ROOT/run}"
BOOTSTRAP_TOOLS_DIR="${BOOTSTRAP_TOOLS_DIR:-$BOOTSTRAP_ROOT/tools}"
BOOTSTRAP_NODE_VERSION="${BOOTSTRAP_NODE_VERSION:-24.14.0}"
BOOTSTRAP_NODE_MIN_MAJOR="${BOOTSTRAP_NODE_MIN_MAJOR:-18}"
BOOTSTRAP_JAVA_VERSION="${BOOTSTRAP_JAVA_VERSION:-17}"
BOOTSTRAP_OLLAMA_VERSION="${BOOTSTRAP_OLLAMA_VERSION:-0.13.5}"
BOOTSTRAP_OLLAMA_MODEL="${BOOTSTRAP_OLLAMA_MODEL:-llama3:latest}"
BOOTSTRAP_OLLAMA_MODEL_DIGEST="${BOOTSTRAP_OLLAMA_MODEL_DIGEST:-365c0bd3c000}"
BOOTSTRAP_TECTONIC_CLI_VERSION="${BOOTSTRAP_TECTONIC_CLI_VERSION:-0.1.0}"
BOOTSTRAP_TECTONIC_CLI_REPOSITORY="${BOOTSTRAP_TECTONIC_CLI_REPOSITORY:-SSD-Brandeis/tectonic-json}"
BOOTSTRAP_TECTONIC_CLI_RELEASE_TAG="${BOOTSTRAP_TECTONIC_CLI_RELEASE_TAG:-v0.1}"
BOOTSTRAP_TECTONIC_REPOSITORY_URL="${BOOTSTRAP_TECTONIC_REPOSITORY_URL:-https://github.com/SSD-Brandeis/Tectonic.git}"
BOOTSTRAP_TECTONIC_BRANCH="${BOOTSTRAP_TECTONIC_BRANCH:-no-marker-array}"
BOOTSTRAP_TECTONIC_MANAGED_DIR="${BOOTSTRAP_TECTONIC_MANAGED_DIR:-$BOOTSTRAP_ROOT/src/Tectonic}"
BOOTSTRAP_TECTONIC_RUST_TOOLCHAIN="${BOOTSTRAP_TECTONIC_RUST_TOOLCHAIN:-nightly}"
BOOTSTRAP_TECTONIC_DOCKER_RUST_IMAGE="${BOOTSTRAP_TECTONIC_DOCKER_RUST_IMAGE:-rust:bookworm}"
BOOTSTRAP_CASSANDRA_CPP_DRIVER_REF="${BOOTSTRAP_CASSANDRA_CPP_DRIVER_REF:-2.17.1}"
BOOTSTRAP_TECTONIC_DOCKER_CPP_JOBS="${BOOTSTRAP_TECTONIC_DOCKER_CPP_JOBS:-2}"
BOOTSTRAP_TECTONIC_DOCKER_CARGO_JOBS="${BOOTSTRAP_TECTONIC_DOCKER_CARGO_JOBS:-2}"
BOOTSTRAP_CASSANDRA_VERSION="${BOOTSTRAP_CASSANDRA_VERSION:-5.0.7}"
BOOTSTRAP_CASSANDRA_HOST="${BOOTSTRAP_CASSANDRA_HOST:-127.0.0.1}"
BOOTSTRAP_CASSANDRA_PORT="${BOOTSTRAP_CASSANDRA_PORT:-9042}"
BOOTSTRAP_OLLAMA_HOST="${BOOTSTRAP_OLLAMA_HOST:-127.0.0.1:11434}"
BOOTSTRAP_OLLAMA_BASE_URL="${BOOTSTRAP_OLLAMA_BASE_URL:-http://$BOOTSTRAP_OLLAMA_HOST}"

bootstrap_log() {
  printf '>>> %s\n' "$*"
}

bootstrap_fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

bootstrap_require_commands() {
  local tool
  local missing=()
  for tool in "$@"; do
    if ! command -v "$tool" >/dev/null 2>&1; then
      missing+=("$tool")
    fi
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    bootstrap_fail "Missing required tools: ${missing[*]}"
  fi
}

bootstrap_resolve_command() {
  local candidate
  candidate="${1:-}"
  if [ -z "$candidate" ]; then
    return 1
  fi
  if [[ "$candidate" == */* ]]; then
    if [ -x "$candidate" ]; then
      printf '%s\n' "$candidate"
      return 0
    fi
    return 1
  fi
  command -v "$candidate" 2>/dev/null || return 1
}

bootstrap_uname_s() {
  if [ -n "${BOOTSTRAP_UNAME_S:-}" ]; then
    printf '%s\n' "$BOOTSTRAP_UNAME_S"
    return
  fi
  uname -s
}

bootstrap_uname_m() {
  if [ -n "${BOOTSTRAP_UNAME_M:-}" ]; then
    printf '%s\n' "$BOOTSTRAP_UNAME_M"
    return
  fi
  uname -m
}

bootstrap_detect_platform() {
  local os arch
  os="$(bootstrap_uname_s)"
  arch="$(bootstrap_uname_m)"
  case "$os" in
    Darwin)
      case "$arch" in
        arm64|aarch64) printf 'darwin-arm64\n' ;;
        x86_64|amd64) printf 'darwin-x64\n' ;;
        *) bootstrap_fail "Unsupported macOS architecture: $arch" ;;
      esac
      ;;
    Linux)
      case "$arch" in
        x86_64|amd64) printf 'linux-x64\n' ;;
        arm64|aarch64) printf 'linux-arm64\n' ;;
        *) bootstrap_fail "Unsupported Linux architecture: $arch" ;;
      esac
      ;;
    *)
      bootstrap_fail "Unsupported operating system: $os"
      ;;
  esac
}

BOOTSTRAP_PLATFORM="${BOOTSTRAP_PLATFORM:-$(bootstrap_detect_platform)}"

bootstrap_supported_platforms() {
  printf '%s\n' "darwin-arm64 darwin-x64 linux-arm64 linux-x64"
}

bootstrap_rust_target() {
  case "${1:-$BOOTSTRAP_PLATFORM}" in
    darwin-arm64) printf 'aarch64-apple-darwin\n' ;;
    darwin-x64) printf 'x86_64-apple-darwin\n' ;;
    linux-arm64) printf 'aarch64-unknown-linux-gnu\n' ;;
    linux-x64) printf 'x86_64-unknown-linux-gnu\n' ;;
    *) bootstrap_fail "Unsupported Rust target platform: ${1:-$BOOTSTRAP_PLATFORM}" ;;
  esac
}

bootstrap_platform_env_key() {
  printf '%s\n' "${1:-$BOOTSTRAP_PLATFORM}" | tr '[:lower:]-' '[:upper:]_'
}

bootstrap_apple_arch() {
  case "${1:-$BOOTSTRAP_PLATFORM}" in
    darwin-arm64) printf 'arm64\n' ;;
    darwin-x64) printf 'x86_64\n' ;;
    *) bootstrap_fail "Unsupported Apple target platform: ${1:-$BOOTSTRAP_PLATFORM}" ;;
  esac
}

bootstrap_package_strategy() {
  local platform host_platform
  platform="${1:-$BOOTSTRAP_PLATFORM}"
  host_platform="${2:-$BOOTSTRAP_PLATFORM}"
  case "$platform" in
    darwin-*)
      case "$host_platform" in
        darwin-*) printf 'host\n' ;;
        *)
          bootstrap_fail "Packaging $platform requires a macOS host; current host platform is $host_platform"
          ;;
      esac
      ;;
    linux-*)
      case "$host_platform" in
        darwin-*) printf 'docker-linux\n' ;;
        linux-*) printf 'host\n' ;;
        *) bootstrap_fail "Unsupported host platform for packaging: $host_platform" ;;
      esac
      ;;
    *)
      bootstrap_fail "Unsupported package platform: $platform"
      ;;
  esac
}

bootstrap_docker_platform() {
  case "${1:-$BOOTSTRAP_PLATFORM}" in
    linux-x64) printf 'linux/amd64\n' ;;
    linux-arm64) printf 'linux/arm64\n' ;;
    *) bootstrap_fail "Unsupported Docker package platform: ${1:-$BOOTSTRAP_PLATFORM}" ;;
  esac
}

bootstrap_node_archive_name() {
  case "${1:-$BOOTSTRAP_PLATFORM}" in
    darwin-arm64) printf 'node-v%s-darwin-arm64.tar.gz\n' "$BOOTSTRAP_NODE_VERSION" ;;
    darwin-x64) printf 'node-v%s-darwin-x64.tar.gz\n' "$BOOTSTRAP_NODE_VERSION" ;;
    linux-arm64) printf 'node-v%s-linux-arm64.tar.xz\n' "$BOOTSTRAP_NODE_VERSION" ;;
    linux-x64) printf 'node-v%s-linux-x64.tar.xz\n' "$BOOTSTRAP_NODE_VERSION" ;;
    *) bootstrap_fail "Unsupported Node platform: ${1:-$BOOTSTRAP_PLATFORM}" ;;
  esac
}

bootstrap_node_archive_url() {
  printf 'https://nodejs.org/dist/v%s/%s\n' \
    "$BOOTSTRAP_NODE_VERSION" \
    "$(bootstrap_node_archive_name "${1:-$BOOTSTRAP_PLATFORM}")"
}

bootstrap_node_home() {
  local platform
  platform="${1:-$BOOTSTRAP_PLATFORM}"
  printf '%s/node/%s/%s\n' \
    "$BOOTSTRAP_TOOLS_DIR" \
    "$platform" \
    "$(basename "$(bootstrap_node_archive_name "$platform")" .tar.gz | sed 's/\.tar\.xz$//')"
}

bootstrap_node_bin() {
  printf '%s/bin/node\n' "$(bootstrap_node_home "${1:-$BOOTSTRAP_PLATFORM}")"
}

bootstrap_npm_bin() {
  printf '%s/bin/npm\n' "$(bootstrap_node_home "${1:-$BOOTSTRAP_PLATFORM}")"
}

bootstrap_node_major_for_bin() {
  local node_bin version
  node_bin="$1"
  version="$("$node_bin" --version 2>/dev/null || true)"
  printf '%s\n' "$version" | sed -E 's/^v([0-9]+).*/\1/'
}

bootstrap_existing_node_bin() {
  local node_bin npm_bin node_major
  node_bin="$(bootstrap_resolve_command node || true)"
  npm_bin="$(bootstrap_resolve_command npm || true)"
  if [ -z "$node_bin" ] || [ -z "$npm_bin" ]; then
    return 1
  fi
  node_major="$(bootstrap_node_major_for_bin "$node_bin")"
  if [ -z "$node_major" ] || [ "$node_major" -lt "$BOOTSTRAP_NODE_MIN_MAJOR" ]; then
    return 1
  fi
  printf '%s\n' "$node_bin"
}

bootstrap_existing_npm_bin() {
  if ! bootstrap_existing_node_bin >/dev/null 2>&1; then
    return 1
  fi
  bootstrap_resolve_command npm
}

bootstrap_java_archive_url() {
  case "${1:-$BOOTSTRAP_PLATFORM}" in
    darwin-arm64)
      printf 'https://api.adoptium.net/v3/binary/latest/%s/ga/mac/aarch64/jdk/hotspot/normal/eclipse\n' "$BOOTSTRAP_JAVA_VERSION"
      ;;
    darwin-x64)
      printf 'https://api.adoptium.net/v3/binary/latest/%s/ga/mac/x64/jdk/hotspot/normal/eclipse\n' "$BOOTSTRAP_JAVA_VERSION"
      ;;
    linux-arm64)
      printf 'https://api.adoptium.net/v3/binary/latest/%s/ga/linux/aarch64/jdk/hotspot/normal/eclipse\n' "$BOOTSTRAP_JAVA_VERSION"
      ;;
    linux-x64)
      printf 'https://api.adoptium.net/v3/binary/latest/%s/ga/linux/x64/jdk/hotspot/normal/eclipse\n' "$BOOTSTRAP_JAVA_VERSION"
      ;;
    *)
      bootstrap_fail "Unsupported Java platform: ${1:-$BOOTSTRAP_PLATFORM}"
      ;;
  esac
}

bootstrap_java_home() {
  local platform
  platform="${1:-$BOOTSTRAP_PLATFORM}"
  printf '%s/java/%s/latest\n' "$BOOTSTRAP_TOOLS_DIR" "$platform"
}

bootstrap_java_bin() {
  local java_home
  java_home="$(bootstrap_java_home "${1:-$BOOTSTRAP_PLATFORM}")"
  if [ -x "$java_home/bin/java" ]; then
    printf '%s/bin/java\n' "$java_home"
    return
  fi
  if [ -x "$java_home/Contents/Home/bin/java" ]; then
    printf '%s/Contents/Home/bin/java\n' "$java_home"
    return
  fi
  printf '%s/bin/java\n' "$java_home"
}

bootstrap_java_major_for_bin() {
  local java_bin version_line
  java_bin="$1"
  version_line="$("$java_bin" -version 2>&1 | head -n 1 || true)"
  printf '%s\n' "$version_line" | sed -nE 's/.*version "([0-9]+).*/\1/p'
}

bootstrap_existing_java_bin() {
  local java_bin java_major
  java_bin="$(bootstrap_resolve_command java || true)"
  if [ -z "$java_bin" ]; then
    return 1
  fi
  java_major="$(bootstrap_java_major_for_bin "$java_bin")"
  if [ "$java_major" != "11" ] && [ "$java_major" != "17" ]; then
    return 1
  fi
  printf '%s\n' "$java_bin"
}

bootstrap_existing_brew_bin() {
  bootstrap_resolve_command brew
}

bootstrap_brew_prefix() {
  local formula brew_bin
  formula="$1"
  brew_bin="$(bootstrap_existing_brew_bin || true)"
  if [ -z "$brew_bin" ]; then
    return 1
  fi
  "$brew_bin" --prefix "$formula" 2>/dev/null
}

bootstrap_brew_home_prefix() {
  local brew_bin
  brew_bin="$(bootstrap_existing_brew_bin || true)"
  if [ -z "$brew_bin" ]; then
    return 1
  fi
  "$brew_bin" --prefix 2>/dev/null
}

bootstrap_tectonic_asset_name() {
  local platform
  platform="${1:-$BOOTSTRAP_PLATFORM}"
  printf 'tectonic-cli-v%s-%s.tar.gz\n' "$BOOTSTRAP_TECTONIC_CLI_VERSION" "$platform"
}

bootstrap_tectonic_asset_url() {
  local platform
  platform="${1:-$BOOTSTRAP_PLATFORM}"
  printf 'https://github.com/%s/releases/download/%s/%s\n' \
    "$BOOTSTRAP_TECTONIC_CLI_REPOSITORY" \
    "$BOOTSTRAP_TECTONIC_CLI_RELEASE_TAG" \
    "$(bootstrap_tectonic_asset_name "$platform")"
}

bootstrap_tectonic_home() {
  local platform
  platform="${1:-$BOOTSTRAP_PLATFORM}"
  printf '%s/tectonic-cli/%s/v%s\n' \
    "$BOOTSTRAP_TOOLS_DIR" \
    "$platform" \
    "$BOOTSTRAP_TECTONIC_CLI_VERSION"
}

bootstrap_tectonic_bin() {
  printf '%s/tectonic-cli\n' "$(bootstrap_tectonic_home "${1:-$BOOTSTRAP_PLATFORM}")"
}

bootstrap_existing_tectonic_bin() {
  local explicit_bin
  explicit_bin="$(bootstrap_resolve_command "${TECTONIC_BIN:-}" || true)"
  if [ -n "$explicit_bin" ]; then
    printf '%s\n' "$explicit_bin"
    return 0
  fi
  bootstrap_resolve_command tectonic-cli
}

bootstrap_cassandra_archive_name() {
  printf 'apache-cassandra-%s-bin.tar.gz\n' "$BOOTSTRAP_CASSANDRA_VERSION"
}

bootstrap_cassandra_archive_url() {
  printf 'https://archive.apache.org/dist/cassandra/%s/%s\n' \
    "$BOOTSTRAP_CASSANDRA_VERSION" \
    "$(bootstrap_cassandra_archive_name)"
}

bootstrap_cassandra_home() {
  printf '%s/cassandra/%s/apache-cassandra-%s\n' \
    "$BOOTSTRAP_TOOLS_DIR" \
    "${1:-$BOOTSTRAP_PLATFORM}" \
    "$BOOTSTRAP_CASSANDRA_VERSION"
}

bootstrap_cassandra_bin() {
  printf '%s/bin/cassandra\n' "$(bootstrap_cassandra_home "${1:-$BOOTSTRAP_PLATFORM}")"
}

bootstrap_cqlsh_bin() {
  printf '%s/bin/cqlsh\n' "$(bootstrap_cassandra_home "${1:-$BOOTSTRAP_PLATFORM}")"
}

bootstrap_existing_cassandra_bin() {
  local cassandra_bin cqlsh_bin
  cassandra_bin="$(bootstrap_resolve_command cassandra || true)"
  cqlsh_bin="$(bootstrap_resolve_command cqlsh || true)"
  if [ -z "$cassandra_bin" ] || [ -z "$cqlsh_bin" ]; then
    return 1
  fi
  printf '%s\n' "$cassandra_bin"
}

bootstrap_existing_cqlsh_bin() {
  if ! bootstrap_existing_cassandra_bin >/dev/null 2>&1; then
    return 1
  fi
  bootstrap_resolve_command cqlsh
}

bootstrap_default_cassandra_sys_lib_path() {
  local platform brew_home_prefix brew_formula_prefix
  platform="${1:-$BOOTSTRAP_PLATFORM}"
  case "$platform" in
    darwin-arm64|darwin-x64)
      brew_home_prefix="$(bootstrap_brew_home_prefix || true)"
      if [ -n "$brew_home_prefix" ] && [ -d "$brew_home_prefix/lib" ]; then
        printf '%s/lib\n' "$brew_home_prefix"
        return
      fi
      brew_formula_prefix="$(bootstrap_brew_prefix cassandra-cpp-driver || true)"
      if [ -n "$brew_formula_prefix" ] && [ -d "$brew_formula_prefix/lib" ]; then
        printf '%s/lib\n' "$brew_formula_prefix"
        return
      fi
      case "$platform" in
        darwin-arm64) printf '/opt/homebrew/lib\n' ;;
        darwin-x64) printf '/usr/local/lib\n' ;;
      esac
      ;;
    linux-*) printf '\n' ;;
    *) printf '\n' ;;
  esac
}

bootstrap_ollama_install_hint() {
  case "${1:-$BOOTSTRAP_PLATFORM}" in
    darwin-*) printf 'https://docs.ollama.com/macos\n' ;;
    linux-*) printf 'https://docs.ollama.com/linux\n' ;;
    *) printf 'https://docs.ollama.com/\n' ;;
  esac
}

bootstrap_existing_ollama_bin() {
  bootstrap_resolve_command ollama
}

bootstrap_existing_curl_bin() {
  local curl_bin brew_prefix
  curl_bin="$(bootstrap_resolve_command curl || true)"
  if [ -n "$curl_bin" ]; then
    printf '%s\n' "$curl_bin"
    return 0
  fi
  brew_prefix="$(bootstrap_brew_prefix curl || true)"
  if [ -n "$brew_prefix" ] && [ -x "$brew_prefix/bin/curl" ]; then
    printf '%s\n' "$brew_prefix/bin/curl"
    return 0
  fi
  return 1
}

bootstrap_existing_sudo_bin() {
  bootstrap_resolve_command sudo
}

bootstrap_existing_linux_package_manager() {
  local tool
  for tool in apt-get dnf yum zypper apk; do
    if bootstrap_resolve_command "$tool" >/dev/null 2>&1; then
      printf '%s\n' "$tool"
      return 0
    fi
  done
  return 1
}

bootstrap_run_privileged() {
  if [ "$(id -u)" = "0" ]; then
    "$@"
    return
  fi
  local sudo_bin
  sudo_bin="$(bootstrap_existing_sudo_bin || true)"
  if [ -n "$sudo_bin" ]; then
    "$sudo_bin" "$@"
    return
  fi
  bootstrap_fail "Administrative privileges are required to install missing system dependencies: $*"
}

bootstrap_install_curl_if_missing() {
  local curl_bin package_manager brew_bin
  curl_bin="$(bootstrap_existing_curl_bin || true)"
  if [ -n "$curl_bin" ]; then
    return 0
  fi
  case "$BOOTSTRAP_PLATFORM" in
    darwin-*)
      brew_bin="$(bootstrap_existing_brew_bin || true)"
      if [ -z "$brew_bin" ]; then
        bootstrap_fail "curl is missing and Homebrew is not available to install it on macOS."
      fi
      bootstrap_log "Installing curl with Homebrew"
      "$brew_bin" install curl
      ;;
    linux-*)
      package_manager="$(bootstrap_existing_linux_package_manager || true)"
      if [ -z "$package_manager" ]; then
        bootstrap_fail "curl is missing and no supported Linux package manager (apt-get, dnf, yum, zypper, apk) was found."
      fi
      bootstrap_log "Installing curl using $package_manager"
      case "$package_manager" in
        apt-get)
          bootstrap_run_privileged apt-get update
          bootstrap_run_privileged apt-get install -y curl ca-certificates
          ;;
        dnf)
          bootstrap_run_privileged dnf install -y curl ca-certificates
          ;;
        yum)
          bootstrap_run_privileged yum install -y curl ca-certificates
          ;;
        zypper)
          bootstrap_run_privileged zypper --non-interactive install curl ca-certificates
          ;;
        apk)
          bootstrap_run_privileged apk add --no-cache curl ca-certificates
          ;;
      esac
      ;;
    *)
      bootstrap_fail "curl is missing and automatic installation is unsupported on $BOOTSTRAP_PLATFORM."
      ;;
  esac
  curl_bin="$(bootstrap_existing_curl_bin || true)"
  if [ -z "$curl_bin" ]; then
    bootstrap_fail "curl install completed, but the curl command is still unavailable."
  fi
  bootstrap_log "curl is ready at $curl_bin"
}

bootstrap_download() {
  local url output
  url="$1"
  output="$2"
  mkdir -p "$(dirname "$output")"
  bootstrap_install_curl_if_missing
  curl --fail --show-error --location --progress-bar -o "$output" "$url"
}

bootstrap_extract_archive() {
  local archive target_dir
  archive="$1"
  target_dir="$2"
  mkdir -p "$target_dir"
  case "$archive" in
    *.tar.gz|*.tgz) tar -xzf "$archive" -C "$target_dir" ;;
    *.tar.xz) tar -xJf "$archive" -C "$target_dir" ;;
    *.zip) unzip -q "$archive" -d "$target_dir" ;;
    *) bootstrap_fail "Unsupported archive format: $archive" ;;
  esac
}

bootstrap_wait_for_http() {
  local url timeout_seconds
  url="$1"
  timeout_seconds="${2:-60}"
  bootstrap_install_curl_if_missing
  local deadline
  deadline=$((SECONDS + timeout_seconds))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if curl --silent --fail "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}
