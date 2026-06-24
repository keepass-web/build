# Build Philosophy and Supply Chain Trust Policy

KeePass Web handles secrets. The build pipeline that produces it is an
extension of that responsibility — a compromised build is as dangerous as a
compromised application. This document explains the design decisions behind the
build system and the threat model they address.

---

## The build pipeline is part of the attack surface

A password manager that ships pristine code through a compromised build
pipeline ships a compromised product. Supply chain attacks are not theoretical:
they target the gap between the code an auditor reviews and the binary a user
runs. Our build system is designed to close that gap.

---

## Reproducible builds are the bridge between source and binary

An open-source codebase is only as trustworthy as the build that produces it.
Without reproducible builds, auditing the source proves nothing about the file
you actually run. With them, any independent party can check out the same
source, run the same build, and confirm that the output matches the published
checksum. Trust established by reviewing the source transfers directly to the
distributable via that checksum.

This is modelled on Signal's reproducible build approach, applied to a web
distributable rather than a native app.

---

## Every dependency is a trust decision

Each tool in the build pipeline is a party we are choosing to trust. We limit
that trust in two ways:

**Pinning** — every dependency is locked to an exact version. Floating versions
(`^1.2.0`, `latest`) mean a future install can silently introduce different
code. We do not use them.

**Integrity verification** — every npm package is recorded in `package-lock.json`
with its sha512 hash. `npm ci` verifies every hash before installation. A
tampered package — whether from a compromised registry, a man-in-the-middle, or
a malicious update — will not install. The Docker base image is pinned by
digest for the same reason: tags are mutable, digests are not.

---

## Output-producing tools receive higher scrutiny

Not all build tools carry equal risk. We distinguish two categories:

- **Output-neutral tools** (Biome) — a formatter that produces wrong output
  loses style consistency. The impact is cosmetic and immediately visible.

- **Output-producing tools** (`tsc`, the inliner) — a compiler or bundler that
  produces wrong output ships bugs or backdoors. The impact is invisible and
  potentially severe.

Output-producing tools are pinned with integrity hashes and reviewed with the
same rigour as source code changes. A change to `package-lock.json` that bumps
`typescript` is treated as a source change, not a housekeeping task.

---

## The inliner is owned, not borrowed

General-purpose bundlers (webpack, rollup, esbuild, and others) are powerful,
complex tools with large dependency trees, plugin systems, and transform
pipelines. Any of those components can be compromised. We do not use them.

The inliner does exactly one thing: reads source files in the order declared in
the build manifest, concatenates them, and writes a single HTML file. Its
entire behaviour is visible in a few hundred lines of code that we own and
review. There is no plugin system, no transform pipeline, no dependency beyond
Node's built-in modules.

The cost is that the inliner has fewer features than a bundler. That cost is
acceptable — and deliberate. Complexity in the build pipeline is a liability,
not an asset.

---

## Dependency updates are source-level changes

A dependency update is not housekeeping. It introduces new code into the build
pipeline, with the same potential for harm as any other code change. Every
dependency update requires:

- A verified integrity hash matched against the npm registry
- A pull request with the lock file diff reviewed at source-level rigour
- No expedited merges

This applies equally to patch versions. A patch version can introduce a
backdoor. Automated dependency update tools (Dependabot, Renovate) are not
used for output-producing tools — their PRs would need the same manual
verification that defeats their purpose.

---

## The trust boundary

We trust:

- **GitHub** — for source hosting, CI execution, and release publication. This
  is a deliberate, scoped trust decision within an established boundary.
- **The npm registry** — at the moment of hash verification only. We trust that
  the published hash for a specific version is correct at the time we record it.
  Subsequent changes to the registry do not affect us because `npm ci` enforces
  the recorded hash.
- **The Docker base image** — at the recorded digest. We pin by digest, not
  tag, so Docker Hub cannot silently change what we pull.

We do not trust:

- Mutable dependency references of any kind
- Build-time network access beyond what is declared and verified
- Automated tooling that bypasses the integrity verification and review process

---

## The hosted site is the release, verbatim

Every file served from keepass-web.app is a verbatim copy of a file published
in a GitHub release. No file is created, modified, or synthesised during
deployment. A user who downloads the release and serves it locally — with Apache,
nginx, or any other web server — has the same files, byte for byte, as the hosted
site. The local experience and the hosted experience are identical, modulo
features gated to the keepass-web.app domain (OAuth client IDs and the like).

This is not a policy aspiration. It is enforced by the pipeline:

1. The release workflow builds each distributable, computes its SHA-256 checksum,
   and signs it with GitHub's build provenance attestation.
2. The deploy workflow downloads each file from the release, verifies the
   attestation, and commits it to gh-pages unchanged.
3. Nothing is written to gh-pages that did not originate as a release artifact.

The consequence is that trust established by auditing the downloaded files
transfers directly to the hosted site — without qualification, without exception.
