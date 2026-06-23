# Releasing

The release pipeline spans two repositories and two workflows. The Release
workflow in `keepass-web` builds, attests, and publishes; the Deploy workflow
in `keepass-web.github.io` verifies and deploys to GitHub Pages.

## Overview

```
git push --follow-tags
  └─ keepass-web: Release workflow
       ├─ lint / typecheck / test
       ├─ build distributables
       ├─ attest with SLSA provenance
       ├─ create GitHub release
       └─ trigger Deploy workflow
            └─ keepass-web.github.io: Deploy workflow
                 ├─ download release assets
                 ├─ verify attestations
                 ├─ push deploy/vX.Y.Z branch
                 └─ open PR → human reviews → squash merge
                      └─ GitHub Pages updated
```

## Cutting a release

From `main` in the `keepass-web` repo:

```sh
npm version patch   # or minor / major
git push --follow-tags
```

`npm version` updates `package.json`, commits the change, and creates a tag.
Pushing the tag triggers the Release workflow.

## The Release workflow

`keepass-web/.github/workflows/release.yml` runs on every `v*` tag push:

1. Checks out source and build tools from `keepass-web/build`
2. Installs dependencies (`npm ci` — every hash verified against `package-lock.json`)
3. Runs lint, type checking, and tests
4. Guards that the tag matches the `package.json` version
5. Builds all distributables
6. Attests each using `actions/attest-build-provenance`, writing a signed
   SLSA provenance record to the Sigstore transparency log
7. Creates the GitHub release and uploads all distributables
8. Generates a short-lived App token scoped to `keepass-web.github.io` and
   triggers the Deploy workflow

## The Deploy workflow

`keepass-web.github.io/.github/workflows/deploy.yml` runs automatically after
a release, or can be triggered manually (Actions → Deploy → Run workflow →
enter release tag):

1. Checks out `gh-pages`
2. Downloads the release assets (over public Internet)
3. Verifies attestations: `gh attestation verify` queries the Sigstore
   transparency log to confirm each file was produced by the Release workflow
   in `keepass-web/keepass-web`; fails immediately if not
4. Pushes a `deploy/vX.Y.Z` branch
5. Opens a PR against `gh-pages` using a GitHub App token

## Human review

The PR is the deployment gate. Review it, then squash merge. Only squash
merging is permitted on `keepass-web.github.io`. GitHub Pages updates
automatically after the merge.

## The GitHub App

`keepass-web-deploy-bot` provides the cross-repo automation. It holds two
permissions on `keepass-web.github.io`:

- `contents: write` — push the deploy branch
- `pull_requests: write` — open the PR

Its credentials are stored as organisation secrets (`DEPLOY_BOT_APP_ID`,
`DEPLOY_BOT_APP_PRIVATE_KEY`) on only these two repo, so that both repos can
reference them. A short-lived installation token is generated at workflow
runtime; no long-lived credential persists in the workflow environment.

## Verifying a release independently

Any party can verify that a published distributable was produced by the Release
workflow:

```sh
gh attestation verify <file> --repo keepass-web/keepass-web
```

This queries the Sigstore transparency log and confirms the attestation
signature matches a run of the Release workflow in `keepass-web/keepass-web`.
A file not produced by that workflow cannot be verified.
