# syntax=docker/dockerfile:1
#
# keepass-web build environment
#
# Defines the complete, pinned toolchain used by every keepass-web CI pipeline.
# All tools are installed at exact versions; npm ci verifies every package's
# sha512 integrity hash from package-lock.json before any build step runs.
#
# Base image: node:22.23.0-slim (Debian bookworm-slim, multi-arch)
# Digest covers amd64 and arm64. Verify with:
#   docker manifest inspect node:22.23.0-slim
FROM node:22.23.0-slim@sha256:d9f850096136edbc402debdd8729579a288aac64574ada0ff4db26b6ae58b0b2

# Tools are installed into /tools. Binaries are placed on PATH.
# npm ci verifies every package's sha512 integrity hash from package-lock.json.
WORKDIR /tools
COPY package.json package-lock.json ./
RUN npm ci

ENV PATH="/tools/node_modules/.bin:$PATH"

WORKDIR /workspace
