# Build Instructions

## Pinned dependencies

All build-time dependencies are pinned with enforced integrity checks:

- **npm packages** (`typescript`, `@biomejs/biome`): exact versions in
  `package.json`; sha512 integrity hashes in `package-lock.json`. `npm ci`
  verifies every hash before installation — no package installs without
  matching its recorded hash.

- **Base container image**: pinned by digest in `Dockerfile`. Tags are
  mutable; the digest is not. Docker verifies the digest at pull time.

To verify any npm package hash independently against the registry:

```sh
npm view <package>@<version> dist.integrity
```

To verify the base image digest independently:

```sh
docker buildx imagetools inspect node:22.23.0-slim --format '{{.Manifest.Digest}}'
```

---

## Reproducing a build

Any party can reproduce a versioned distributable and verify it against the
published checksum. The steps are:

1. Check out the exact tagged commit of the application repo:

   ```sh
   git clone https://github.com/keepass-web/keepass-web
   cd keepass-web
   git checkout v<version>
   ```

2. Build the container image from this repo at the same tagged commit:

   ```sh
   git clone https://github.com/keepass-web/build
   cd build
   git checkout v<version>
   docker build -t keepass-web-build .
   ```

3. Run the build inside the container:

   ```sh
   cd ../keepass-web
   docker run --rm -v "$PWD":/workspace keepass-web-build \
     sh -c "npm ci && node --experimental-strip-types build/inliner/src/index.ts build.json"
   ```

   The inliner prints `sha256:<hex>` to stdout.

4. Compare the printed checksum against the value published with the release.

Two independent builds of the same source commit must produce an identical
checksum. A mismatch means the build is not reproducible and should be treated
as suspect.

---

## Updating a dependency

Dependency updates require source-level review — the same rigour as source
code changes.

**npm package update:**

1. Update the version in `package.json`.
2. Regenerate `package-lock.json`: `npm install --package-lock-only`.
3. Verify the new integrity hash against the registry: `npm view <package>@<version> dist.integrity`.
4. Open a pull request. Review the diff to `package-lock.json` with the same
   care as a source change.

**Base image update:**

1. Update the `FROM` line in `Dockerfile` with the new version tag and its digest.
2. Verify the digest: `docker buildx imagetools inspect node:<version>-slim --format '{{.Manifest.Digest}}'`.
3. Open a pull request.

No dependency update is merged without a verified, reviewed change to the
relevant pinning file (`package-lock.json` or `Dockerfile`).
