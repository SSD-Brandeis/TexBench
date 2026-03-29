# syntax=docker/dockerfile:1.7
ARG RUST_IMAGE=rust:bookworm
FROM --platform=$TARGETPLATFORM ${RUST_IMAGE} AS builder

ARG RUST_TOOLCHAIN=nightly
ARG TARGET_TRIPLE
ARG CASSANDRA_CPP_DRIVER_REF=2.17.1
ARG CPP_BUILD_JOBS=2
ARG CARGO_BUILD_JOBS=2

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential \
  ca-certificates \
  clang \
  cmake \
  gcc-11 \
  g++-11 \
  git \
  libclang-dev \
  libkrb5-dev \
  libssl-dev \
  libuv1-dev \
  pkg-config \
  zlib1g-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /tmp
RUN git clone --depth 1 --branch "${CASSANDRA_CPP_DRIVER_REF}" https://github.com/datastax/cpp-driver.git cassandra-cpp-driver \
  && cmake -S cassandra-cpp-driver -B cassandra-cpp-driver/build \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_C_COMPILER=gcc-11 \
    -DCMAKE_CXX_COMPILER=g++-11 \
    -DCASS_BUILD_SHARED=ON \
    -DCASS_BUILD_STATIC=OFF \
    -DCASS_BUILD_TESTS=OFF \
    -DCASS_USE_KERBEROS=OFF \
  && cmake --build cassandra-cpp-driver/build --parallel "${CPP_BUILD_JOBS}" \
  && cmake --install cassandra-cpp-driver/build \
  && ldconfig

WORKDIR /src
COPY tectonic-src /src

ENV CASSANDRA_SYS_LIB_PATH=/usr/local/lib
ENV CC=gcc-11
ENV CXX=g++-11
RUN rustup toolchain install "${RUST_TOOLCHAIN}"
RUN rustup target add --toolchain "${RUST_TOOLCHAIN}" "${TARGET_TRIPLE}"
RUN cargo +"${RUST_TOOLCHAIN}" build --jobs "${CARGO_BUILD_JOBS}" --release --target "${TARGET_TRIPLE}" --all-features

RUN install -D "target/${TARGET_TRIPLE}/release/tectonic-cli" /out/tectonic-cli \
  && mkdir -p /out/lib \
  && cp -P /usr/local/lib/libcassandra.so* /out/lib/

FROM scratch AS export
COPY --from=builder /out/tectonic-cli /tectonic-cli
