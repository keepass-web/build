# Pipeline

This document maps the complete build, release, and deploy pipeline across all
KeePass Web repositories. It exists so that a reader auditing this repo has a
full picture of where every piece of pipeline code lives — including the pieces
that do not live here.

---

## Workflow inventory

Two workflows live in this repo and are consumed by all others as reusable
workflows. Everything else is substantive workflow code that lives in the repo
it belongs to.

| Workflow | Location | Type |
|---|---|---|
| CI pipeline | `keepass-web/build/.github/workflows/ci.yml` | Reusable — called by all repos |
| Library npm publish | `keepass-web/build/.github/workflows/release.yml` | Reusable — called by library repos |
| App release | `keepass-web/keepass-web/.github/workflows/release.yml` | Substantive — not a caller |
| Deploy | `keepass-web/keepass-web.github.io/.github/workflows/deploy.yml` | Substantive — not a caller |
| Deploy verification | `keepass-web/keepass-web.github.io/.github/workflows/ci.yml` | Substantive — not a caller |

The thin `ci.yml` and `release.yml` in each library repo delegate entirely to
this repo and contain no logic of their own. They exist because GitHub Actions
requires the triggering workflow to reside in the repo that owns the event.

### Why the app release and deploy workflows do not live here

The reusable CI and library release workflows are genuinely generic — every
library does the same thing. The app release workflow builds specific
distributables from a specific source layout and attests specific artifact
names. The deploy workflow downloads those specific files, verifies them, and
deploys to a specific GitHub Pages repo. Neither workflow can be meaningfully
parameterised without becoming as complex as the code it replaces.

The practical consequence: to audit the complete pipeline, a reader must read
three locations — this repo, `keepass-web/keepass-web`, and
`keepass-web/keepass-web.github.io`. This document links each.

---

## Architecture

```mermaid
flowchart TD
    subgraph build["keepass-web/build — this repo"]
        RCI["ci.yml\nReusable CI pipeline"]
        RREL["release.yml\nReusable npm publish"]
    end

    subgraph libs["Library repos: argon2 · chacha20 · kdbx"]
        LCI["ci.yml\nthin caller"]
        LREL["release.yml\nthin caller"]
    end

    subgraph app["keepass-web/keepass-web"]
        ACI["ci.yml\nthin caller"]
        AREL["release.yml\nsubstantive"]
    end

    subgraph pages["keepass-web/keepass-web.github.io"]
        DCI["ci.yml\nsubstantive"]
        DEPLOY["deploy.yml\nsubstantive"]
    end

    RCI -->|called by| LCI
    RCI -->|called by| ACI
    RREL -->|called by| LREL
    AREL -->|triggers| DEPLOY
    AREL -->|produces assets verified by| DCI
```

---

## CI pipeline

Runs on every push and pull request in every repository. Defined in
`ci.yml` in this repo; each repository's thin `ci.yml` calls it.

```mermaid
flowchart TD
    E["Push or pull request"]
    E --> RULE["Ruleset check\nValidates branch protection rules\nagainst the required configuration.\nFails immediately if not met."]
    RULE -->|fail| STOP(["Pipeline blocked"])
    RULE -->|pass| LINT["Biome lint and format"]
    LINT --> TC["tsc --noEmit type check"]
    TC --> TEST["node:test suite"]
    TEST --> IS_APP{"app-repo: true?"}
    IS_APP -->|no| DONE(["Done"])
    IS_APP -->|yes| BUILD["Build distributables\ninliner × 3 pages + copy CNAME"]
    BUILD --> SUM["Publish checksums\nto step summary"]
    SUM --> DONE
```

---

## Library release pipeline

Runs when a `v*` tag is pushed to a library repo (`argon2`, `chacha20`,
`kdbx`). The thin `release.yml` in each library calls the reusable workflow
defined in this repo.

npm trusted publishing (OIDC) is used: no `NPM_TOKEN` is stored. The trusted
publisher on npmjs.com is configured against the **caller** repo and workflow
(`keepass-web/<repo> → release.yml`), not this reusable workflow.

```mermaid
flowchart TD
    TAG["git push --follow-tags\n(library repo)"]
    TAG --> THIN["library/release.yml\nthin caller"]
    THIN --> RR["keepass-web/build\nrelease.yml"]
    RR --> CI2["Lint · type check · test"]
    CI2 --> VER["Verify tag = package.json version"]
    VER --> BLD["npm run build\n(compile TypeScript → dist/)"]
    BLD --> PUB["npm publish\nwith OIDC provenance"]
    PUB --> NPM(["Published to @keepass-web\non npmjs.com"])
```

---

## App release pipeline

Runs when a `v*` tag is pushed to `keepass-web/keepass-web`. Defined entirely
in `keepass-web/keepass-web/.github/workflows/release.yml` — not a caller of
any reusable workflow in this repo.

```mermaid
flowchart TD
    TAG["git push --follow-tags\n(keepass-web/keepass-web)"]
    TAG --> AREL["keepass-web/keepass-web\nrelease.yml"]
    AREL --> CKO["Checkout source\n+ build tools from keepass-web/build"]
    CKO --> CI3["Lint · type check · test"]
    CI3 --> VER2["Verify tag = package.json version"]
    VER2 --> BUILD["Build distributables\ninliner × 3 + copy CNAME\nOutputs: keepass-web-0x67.html\nkeepass-web-router.html\nindex.html · CNAME"]
    BUILD --> ATTEST["Attest all four files\nactions/attest-build-provenance\nSigns to Sigstore transparency log"]
    ATTEST --> GHREL["Create GitHub release\nUpload all four files\nPublish checksums in release notes"]
    GHREL --> TOKEN["Generate short-lived App token\nscoped to keepass-web.github.io"]
    TOKEN --> TRIG["Trigger deploy workflow\nvia workflow_dispatch"]
    TRIG --> DEPLOY(["Deploy pipeline begins"])
```

---

## Deploy pipeline

Runs automatically after a release, or manually via Actions → Deploy →
Run workflow. Defined entirely in
`keepass-web/keepass-web.github.io/.github/workflows/deploy.yml`.

Every file committed to `gh-pages` is a verbatim copy of a release artifact.
Nothing is created or modified during deployment.

```mermaid
flowchart TD
    TRIG["Triggered by release\nor manual dispatch"]
    TRIG --> CKO2["Checkout gh-pages branch"]
    CKO2 --> DL["Download all four release assets\nfrom public GitHub release URL\nNo token required"]
    DL --> V1["gh attestation verify keepass-web-0x67.html"]
    V1 --> V2["gh attestation verify keepass-web-router.html"]
    V2 --> V3["gh attestation verify index.html"]
    V3 --> V4["gh attestation verify CNAME"]
    V4 --> OK{"All verified against\nkeepass-web/keepass-web?"}
    OK -->|no| FAIL(["Fail — workflow stops\nNothing is deployed"])
    OK -->|yes| PUSH["Push deploy/vX.Y.Z branch\ngit add all four files\nNo other files touched"]
    PUSH --> PR["Open PR against gh-pages\nvia GitHub App token"]
    PR --> HUMAN["Human review"]
    HUMAN --> MERGE["Squash merge\n(only merge strategy permitted)"]
    MERGE --> PAGES(["GitHub Pages updated\nkeepass-web.app serves new release"])
```

### Deploy PR verification

Every PR targeting `gh-pages` runs `keepass-web.github.io/ci.yml`, which
verifies the distributables before the PR can be merged. Checksum verification
against the published release is [not yet implemented](https://github.com/keepass-web/keepass-web.github.io/blob/main/.github/workflows/ci.yml).

---

## Attestation and the trust chain

```mermaid
flowchart LR
    SRC["Source code\naudit here"]
    SRC --> BUILD2["Release workflow\nbuilds distributables"]
    BUILD2 --> SIG["Sigstore\ntransparency log\nattestation signed"]
    SIG --> REL["GitHub release\nartifacts + checksums"]
    REL --> VER3["Deploy workflow\ngh attestation verify"]
    VER3 --> SITE["keepass-web.app\nidentical files"]
    REL --> LOCAL["Local download\nidentical files"]

    SITE -. "same bytes" .- LOCAL
```

A file on keepass-web.app and a file downloaded from the GitHub release are the
same bytes. Trust established by auditing the source and verifying the
attestation transfers to both without qualification.
