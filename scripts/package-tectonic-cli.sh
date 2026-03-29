#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/bootstrap-lib.sh"

PACKAGE_DRY_RUN="${PACKAGE_DRY_RUN:-0}"
PACKAGE_FORCE="${PACKAGE_FORCE:-0}"
TECTONIC_SOURCE_DIR_EXPLICIT=0
if [ -n "${TECTONIC_SOURCE_DIR:-}" ]; then
  TECTONIC_SOURCE_DIR_EXPLICIT=1
fi

TECTONIC_SOURCE_DIR="${TECTONIC_SOURCE_DIR:-$BOOTSTRAP_TECTONIC_MANAGED_DIR}"
DIST_DIR="${DIST_DIR:-$BOOTSTRAP_REPO_ROOT/dist}"
PACKAGE_PLATFORMS="${PACKAGE_PLATFORMS:-$BOOTSTRAP_PLATFORM}"
HOST_PLATFORM="$BOOTSTRAP_PLATFORM"
TECTONIC_CHECKOUT_READY=0
SUCCESSFUL_PLATFORMS=()
FAILED_PLATFORMS=()
SKIPPED_PLATFORMS=()

TMP_DIR="$(mktemp -d)"
cleanup_tmp() {
  rm -rf "$TMP_DIR"
}
trap cleanup_tmp EXIT

package_is_dry_run() {
  [ "$PACKAGE_DRY_RUN" = "1" ]
}

package_run() {
  if package_is_dry_run; then
    printf 'DRY_RUN'
    printf ' %q' "$@"
    printf '\n'
    return 0
  fi
  "$@"
}

package_require_commands() {
  if package_is_dry_run; then
    return 0
  fi
  bootstrap_require_commands "$@"
}

package_should_force() {
  [ "$PACKAGE_FORCE" = "1" ]
}

package_git_branch() {
  git -C "$1" rev-parse --abbrev-ref HEAD
}

package_git_worktree_dirty() {
  local source_dir
  source_dir="$1"
  ! git -C "$source_dir" diff --quiet --ignore-submodules HEAD -- ||
    ! git -C "$source_dir" diff --cached --quiet --ignore-submodules HEAD --
}

resolve_cassandra_sys_lib_path() {
  local platform env_key specific_key specific_value default_value
  platform="$1"
  env_key="$(bootstrap_platform_env_key "$platform")"
  specific_key="CASSANDRA_SYS_LIB_PATH_${env_key}"
  specific_value="${!specific_key:-}"
  if [ -n "$specific_value" ]; then
    printf '%s\n' "$specific_value"
    return
  fi
  if [ -n "${CASSANDRA_SYS_LIB_PATH:-}" ]; then
    printf '%s\n' "$CASSANDRA_SYS_LIB_PATH"
    return
  fi
  default_value="$(bootstrap_default_cassandra_sys_lib_path "$platform")"
  printf '%s\n' "$default_value"
}

resolve_openssl_prefix() {
  local platform brew_prefix
  platform="$1"
  case "$platform" in
    darwin-*)
      brew_prefix="$(bootstrap_brew_prefix openssl@3 || true)"
      if [ -n "$brew_prefix" ] && [ -d "$brew_prefix/lib" ] && [ -d "$brew_prefix/include" ]; then
        printf '%s\n' "$brew_prefix"
        return
      fi
      ;;
  esac
  printf '\n'
}

ensure_rust_target_installed() {
  local rust_target toolchain
  rust_target="$1"
  toolchain="$BOOTSTRAP_TECTONIC_RUST_TOOLCHAIN"
  if package_is_dry_run; then
    bootstrap_log "Would ensure Rust toolchain $toolchain and target $rust_target are installed"
    return 0
  fi
  if ! command -v rustup >/dev/null 2>&1; then
    bootstrap_fail "rustup is required to install the $toolchain toolchain for Tectonic packaging."
  fi
  if ! rustup toolchain list | awk '{print $1}' | grep -qx "$toolchain"; then
    bootstrap_log "Installing Rust toolchain $toolchain"
    rustup toolchain install "$toolchain"
  fi
  if rustup target list --toolchain "$toolchain" --installed | grep -qx "$rust_target"; then
    return 0
  fi
  bootstrap_log "Installing Rust target $rust_target for toolchain $toolchain"
  rustup target add --toolchain "$toolchain" "$rust_target"
}

resolve_built_tectonic_bin() {
  local rust_target default_path discovered_path
  rust_target="$1"
  default_path="$TECTONIC_SOURCE_DIR/target/$rust_target/release/tectonic-cli"
  if [ -x "$default_path" ]; then
    printf '%s\n' "$default_path"
    return 0
  fi
  discovered_path="$(
    find "$TECTONIC_SOURCE_DIR/target" \
      -path "*/$rust_target/release/tectonic-cli" \
      -type f -perm -u+x 2>/dev/null | head -n 1
  )"
  if [ -n "$discovered_path" ] && [ -x "$discovered_path" ]; then
    printf '%s\n' "$discovered_path"
    return 0
  fi
  return 1
}

bootstrap_checkout_branch() {
  local source_dir
  source_dir="$1"
  bootstrap_log "Syncing Tectonic checkout to branch $BOOTSTRAP_TECTONIC_BRANCH"
  package_run git -C "$source_dir" fetch --depth 1 origin "$BOOTSTRAP_TECTONIC_BRANCH"
  package_run git -C "$source_dir" checkout -B "$BOOTSTRAP_TECTONIC_BRANCH" "origin/$BOOTSTRAP_TECTONIC_BRANCH"
}

ensure_managed_tectonic_checkout() {
  mkdir -p "$(dirname "$TECTONIC_SOURCE_DIR")"
  if [ ! -d "$TECTONIC_SOURCE_DIR/.git" ]; then
    bootstrap_log "Cloning managed Tectonic checkout into $TECTONIC_SOURCE_DIR"
    package_run git clone --branch "$BOOTSTRAP_TECTONIC_BRANCH" --single-branch "$BOOTSTRAP_TECTONIC_REPOSITORY_URL" "$TECTONIC_SOURCE_DIR"
  fi
  if [ -d "$TECTONIC_SOURCE_DIR/.git" ] && ! package_is_dry_run && package_git_worktree_dirty "$TECTONIC_SOURCE_DIR"; then
    bootstrap_fail "Managed Tectonic checkout at $TECTONIC_SOURCE_DIR has local changes. Clean it or set TECTONIC_SOURCE_DIR."
  fi
  bootstrap_checkout_branch "$TECTONIC_SOURCE_DIR"
}

ensure_explicit_tectonic_checkout() {
  local current_branch
  if [ ! -f "$TECTONIC_SOURCE_DIR/Cargo.toml" ]; then
    bootstrap_fail "TECTONIC_SOURCE_DIR does not point to a Tectonic checkout: $TECTONIC_SOURCE_DIR"
  fi
  if ! git -C "$TECTONIC_SOURCE_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    bootstrap_fail "TECTONIC_SOURCE_DIR must point to a git checkout so the packaging script can select branch $BOOTSTRAP_TECTONIC_BRANCH."
  fi
  current_branch="$(package_git_branch "$TECTONIC_SOURCE_DIR" || true)"
  if ! package_is_dry_run && package_git_worktree_dirty "$TECTONIC_SOURCE_DIR"; then
    if [ "$current_branch" != "$BOOTSTRAP_TECTONIC_BRANCH" ]; then
      bootstrap_fail "Explicit Tectonic checkout at $TECTONIC_SOURCE_DIR has local changes on branch $current_branch. Switch it to $BOOTSTRAP_TECTONIC_BRANCH manually or clean the worktree first."
    fi
    bootstrap_log "Using explicit Tectonic checkout on dirty branch $current_branch without changing branch."
    return
  fi
  if [ "$current_branch" != "$BOOTSTRAP_TECTONIC_BRANCH" ]; then
    bootstrap_log "Switching explicit Tectonic checkout from ${current_branch:-<unknown>} to $BOOTSTRAP_TECTONIC_BRANCH"
  fi
  bootstrap_checkout_branch "$TECTONIC_SOURCE_DIR"
}

ensure_tectonic_checkout() {
  package_require_commands git
  if [ "$TECTONIC_SOURCE_DIR_EXPLICIT" -eq 1 ]; then
    ensure_explicit_tectonic_checkout
  else
    ensure_managed_tectonic_checkout
  fi
  if ! package_is_dry_run && [ ! -f "$TECTONIC_SOURCE_DIR/Cargo.toml" ]; then
    bootstrap_fail "Resolved Tectonic checkout is missing Cargo.toml: $TECTONIC_SOURCE_DIR"
  fi
}

ensure_tectonic_checkout_once() {
  if [ "$TECTONIC_CHECKOUT_READY" = "1" ]; then
    return 0
  fi
  ensure_tectonic_checkout
  TECTONIC_CHECKOUT_READY=1
}

package_asset_path_for_platform() {
  printf '%s/%s\n' "$DIST_DIR" "$(bootstrap_tectonic_asset_name "$1")"
}

package_should_skip_platform() {
  local platform asset_path
  platform="$1"
  asset_path="$(package_asset_path_for_platform "$platform")"
  if package_should_force; then
    return 1
  fi
  [ -f "$asset_path" ]
}

package_should_skip_for_host_constraints() {
  local platform
  platform="$1"
  if [ "$HOST_PLATFORM" = "darwin-arm64" ] && [ "$platform" = "darwin-x64" ]; then
    bootstrap_log "Skipping $platform on $HOST_PLATFORM because this host does not have x86_64 macOS native dependencies for Cassandra/OpenSSL."
    return 0
  fi
  return 1
}

require_docker_buildx() {
  package_require_commands docker
  if package_is_dry_run; then
    return 0
  fi
  if ! docker buildx version >/dev/null 2>&1; then
    bootstrap_fail "docker buildx is required for Linux packaging from macOS."
  fi
}

prepare_linux_build_context() {
  local platform context_dir
  platform="$1"
  context_dir="$TMP_DIR/docker-context/$platform"
  if package_is_dry_run; then
    printf '%s\n' "$context_dir"
    return
  fi
  mkdir -p "$context_dir/tectonic-src"
  cp "$BOOTSTRAP_REPO_ROOT/docker/tectonic-cli-linux-builder.Dockerfile" "$context_dir/Dockerfile"
  tar -C "$TECTONIC_SOURCE_DIR" \
    --exclude='.git' \
    --exclude='target' \
    --exclude='dist' \
    -cf - . | tar -C "$context_dir/tectonic-src" -xf -
  printf '%s\n' "$context_dir"
}

package_built_binary() {
  local built_bin asset_path
  built_bin="$1"
  asset_path="$2"
  if package_is_dry_run; then
    bootstrap_log "Would package $built_bin into $asset_path"
    return 0
  fi
  rm -f "$TMP_DIR/tectonic-cli"
  cp "$built_bin" "$TMP_DIR/tectonic-cli"
  chmod +x "$TMP_DIR/tectonic-cli"
  tar -czf "$asset_path" -C "$TMP_DIR" tectonic-cli
}

build_host_platform() {
  local platform rust_target asset_name asset_path built_bin cassandra_sys_lib_path openssl_prefix
  local target_env_key linker_var cc_var cxx_var ar_var cflags_var cxxflags_var
  local sdkroot apple_arch clang_bin clangxx_bin ar_bin
  platform="$1"
  ensure_tectonic_checkout_once
  rust_target="$(bootstrap_rust_target "$platform")"
  asset_name="$(bootstrap_tectonic_asset_name "$platform")"
  asset_path="$DIST_DIR/$asset_name"
  cassandra_sys_lib_path="$(resolve_cassandra_sys_lib_path "$platform")"
  openssl_prefix="$(resolve_openssl_prefix "$platform")"

  package_require_commands cargo tar
  if [[ "$platform" == darwin-* ]]; then
    package_require_commands xcrun
  fi

  bootstrap_log "Building $platform ($rust_target) via host toolchain"
  ensure_rust_target_installed "$rust_target"

  if package_is_dry_run; then
    if [ -n "$cassandra_sys_lib_path" ]; then
      bootstrap_log "Would build with CASSANDRA_SYS_LIB_PATH=$cassandra_sys_lib_path"
    fi
    if [ -n "$openssl_prefix" ]; then
      bootstrap_log "Would build with OPENSSL_DIR=$openssl_prefix"
    fi
    if [[ "$platform" == darwin-* ]]; then
      bootstrap_log "Would configure Apple SDK and target-specific clang flags for $platform"
    fi
    package_run cargo "+$BOOTSTRAP_TECTONIC_RUST_TOOLCHAIN" build --release --target "$rust_target" --all-features
    package_built_binary "$TECTONIC_SOURCE_DIR/target/$rust_target/release/tectonic-cli" "$asset_path"
    SUCCESSFUL_PLATFORMS+=("$platform")
    return 0
  fi

  if (
    cd "$TECTONIC_SOURCE_DIR"
    if [ -n "$cassandra_sys_lib_path" ]; then
      export CASSANDRA_SYS_LIB_PATH="$cassandra_sys_lib_path"
      bootstrap_log "Using CASSANDRA_SYS_LIB_PATH=$CASSANDRA_SYS_LIB_PATH"
    fi
    if [ -n "$openssl_prefix" ]; then
      export OPENSSL_DIR="$openssl_prefix"
      export OPENSSL_ROOT_DIR="$openssl_prefix"
      export OPENSSL_LIB_DIR="$openssl_prefix/lib"
      export OPENSSL_INCLUDE_DIR="$openssl_prefix/include"
      export PKG_CONFIG_PATH="$openssl_prefix/lib/pkgconfig${PKG_CONFIG_PATH:+:$PKG_CONFIG_PATH}"
      export LDFLAGS="-L$openssl_prefix/lib${LDFLAGS:+ $LDFLAGS}"
      export CPPFLAGS="-I$openssl_prefix/include${CPPFLAGS:+ $CPPFLAGS}"
      bootstrap_log "Using OPENSSL_DIR=$OPENSSL_DIR"
    fi
    if [[ "$platform" == darwin-* ]]; then
      sdkroot="$(xcrun --sdk macosx --show-sdk-path)"
      apple_arch="$(bootstrap_apple_arch "$platform")"
      clang_bin="$(xcrun -f clang)"
      clangxx_bin="$(xcrun -f clang++)"
      ar_bin="$(xcrun -f ar)"
      target_env_key="$(printf '%s' "$rust_target" | tr '[:lower:]-' '[:upper:]_')"
      printf -v linker_var 'CARGO_TARGET_%s_LINKER' "$target_env_key"
      printf -v cc_var 'CC_%s' "$target_env_key"
      printf -v cxx_var 'CXX_%s' "$target_env_key"
      printf -v ar_var 'AR_%s' "$target_env_key"
      printf -v cflags_var 'CFLAGS_%s' "$target_env_key"
      printf -v cxxflags_var 'CXXFLAGS_%s' "$target_env_key"
      export SDKROOT="$sdkroot"
      export MACOSX_DEPLOYMENT_TARGET="${MACOSX_DEPLOYMENT_TARGET:-13.0}"
      export "$linker_var=$clang_bin"
      export "$cc_var=$clang_bin"
      export "$cxx_var=$clangxx_bin"
      export "$ar_var=$ar_bin"
      export "$cflags_var=-arch $apple_arch -isysroot $sdkroot${CPPFLAGS:+ $CPPFLAGS}"
      export "$cxxflags_var=-arch $apple_arch -isysroot $sdkroot${CPPFLAGS:+ $CPPFLAGS}"
    fi
    cargo "+$BOOTSTRAP_TECTONIC_RUST_TOOLCHAIN" build --release --target "$rust_target" --all-features
  ); then
    built_bin="$(resolve_built_tectonic_bin "$rust_target" || true)"
    if [ -z "$built_bin" ]; then
      bootstrap_log "Build for $platform completed but no tectonic-cli binary was found under target/$rust_target."
      FAILED_PLATFORMS+=("$platform")
      return 1
    fi
    bootstrap_log "Using built binary at $built_bin"
    package_built_binary "$built_bin" "$asset_path"
    bootstrap_log "Created $asset_path"
    SUCCESSFUL_PLATFORMS+=("$platform")
    return 0
  fi

  bootstrap_log "Build failed for $platform"
  FAILED_PLATFORMS+=("$platform")
  return 1
}

build_linux_platform_in_docker() {
  local platform rust_target asset_name asset_path docker_platform context_dir out_dir built_bin
  platform="$1"
  ensure_tectonic_checkout_once
  rust_target="$(bootstrap_rust_target "$platform")"
  asset_name="$(bootstrap_tectonic_asset_name "$platform")"
  asset_path="$DIST_DIR/$asset_name"
  docker_platform="$(bootstrap_docker_platform "$platform")"
  context_dir="$(prepare_linux_build_context "$platform")"
  out_dir="$TMP_DIR/docker-out/$platform"

  package_require_commands tar
  require_docker_buildx
  bootstrap_log "Building $platform ($rust_target) via Docker buildx on $docker_platform"
  bootstrap_log "Staging Docker build context at $context_dir"

  if package_is_dry_run; then
    package_run docker buildx build \
      --platform "$docker_platform" \
      --target export \
      --build-arg "RUST_IMAGE=$BOOTSTRAP_TECTONIC_DOCKER_RUST_IMAGE" \
      --build-arg "RUST_TOOLCHAIN=$BOOTSTRAP_TECTONIC_RUST_TOOLCHAIN" \
      --build-arg "TARGET_TRIPLE=$rust_target" \
      --build-arg "CASSANDRA_CPP_DRIVER_REF=$BOOTSTRAP_CASSANDRA_CPP_DRIVER_REF" \
      --build-arg "CPP_BUILD_JOBS=$BOOTSTRAP_TECTONIC_DOCKER_CPP_JOBS" \
      --build-arg "CARGO_BUILD_JOBS=$BOOTSTRAP_TECTONIC_DOCKER_CARGO_JOBS" \
      --output "type=local,dest=$out_dir" \
      "$context_dir"
    package_built_binary "$out_dir/tectonic-cli" "$asset_path"
    SUCCESSFUL_PLATFORMS+=("$platform")
    return 0
  fi

  mkdir -p "$out_dir"
  if docker buildx build \
    --platform "$docker_platform" \
    --target export \
    --build-arg "RUST_IMAGE=$BOOTSTRAP_TECTONIC_DOCKER_RUST_IMAGE" \
    --build-arg "RUST_TOOLCHAIN=$BOOTSTRAP_TECTONIC_RUST_TOOLCHAIN" \
    --build-arg "TARGET_TRIPLE=$rust_target" \
    --build-arg "CASSANDRA_CPP_DRIVER_REF=$BOOTSTRAP_CASSANDRA_CPP_DRIVER_REF" \
    --build-arg "CPP_BUILD_JOBS=$BOOTSTRAP_TECTONIC_DOCKER_CPP_JOBS" \
    --build-arg "CARGO_BUILD_JOBS=$BOOTSTRAP_TECTONIC_DOCKER_CARGO_JOBS" \
    --output "type=local,dest=$out_dir" \
    "$context_dir"; then
    built_bin="$out_dir/tectonic-cli"
    if [ ! -x "$built_bin" ]; then
      bootstrap_log "Docker build for $platform completed but $built_bin was not produced."
      FAILED_PLATFORMS+=("$platform")
      return 1
    fi
    package_built_binary "$built_bin" "$asset_path"
    bootstrap_log "Created $asset_path"
    SUCCESSFUL_PLATFORMS+=("$platform")
    return 0
  fi

  bootstrap_log "Docker build failed for $platform"
  FAILED_PLATFORMS+=("$platform")
  return 1
}

mkdir -p "$DIST_DIR"
bootstrap_log "Packaging tectonic-cli for platforms: $PACKAGE_PLATFORMS"
bootstrap_log "Host platform: $HOST_PLATFORM"
bootstrap_log "Source checkout: $TECTONIC_SOURCE_DIR"
bootstrap_log "Selected Tectonic branch: $BOOTSTRAP_TECTONIC_BRANCH"
bootstrap_log "Build mode: --all-features"
if package_should_force; then
  bootstrap_log "Package force mode: rebuilding even when dist assets already exist"
fi

OLD_IFS="$IFS"
IFS=','
for platform in $PACKAGE_PLATFORMS; do
  platform="$(printf '%s' "$platform" | xargs)"
  [ -n "$platform" ] || continue
  if package_should_skip_platform "$platform"; then
    bootstrap_log "Skipping $platform because $(package_asset_path_for_platform "$platform") already exists"
    SKIPPED_PLATFORMS+=("$platform")
    continue
  fi
  if package_should_skip_for_host_constraints "$platform"; then
    SKIPPED_PLATFORMS+=("$platform")
    continue
  fi
  strategy="$(bootstrap_package_strategy "$platform" "$HOST_PLATFORM")"
  bootstrap_log "Strategy for $platform: $strategy"
  case "$strategy" in
    host)
      build_host_platform "$platform" || true
      ;;
    docker-linux)
      build_linux_platform_in_docker "$platform" || true
      ;;
    *)
      bootstrap_log "Unsupported build strategy for $platform: $strategy"
      FAILED_PLATFORMS+=("$platform")
      ;;
  esac
done
IFS="$OLD_IFS"

if [ "${#SUCCESSFUL_PLATFORMS[@]}" -gt 0 ]; then
  bootstrap_log "Packaged platforms: ${SUCCESSFUL_PLATFORMS[*]}"
fi
if [ "${#SKIPPED_PLATFORMS[@]}" -gt 0 ]; then
  bootstrap_log "Skipped platforms: ${SKIPPED_PLATFORMS[*]}"
fi
if [ "${#FAILED_PLATFORMS[@]}" -gt 0 ]; then
  bootstrap_fail "Failed platforms: ${FAILED_PLATFORMS[*]}"
fi
