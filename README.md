# keepass-web/build

Build infrastructure, CI pipeline, and reproducible build tooling for the KeePass Web project.

All of our build infrastructure resides here so that there is a single, auditable location for verifying build correctness. Every build-time dependency is pinned at an exact version with a verified integrity hash — nothing installs without matching its recorded value. The build process is fully reproducible: any independent party can check out the same source, build using the same containerised environment, and confirm that the output matches the checksum published with the release. The inliner that produces each distributable is a purpose-written, minimal tool owned entirely by this project — no general-purpose bundler whose behaviour we do not fully control.

## What's in this repo

- A Docker-based build environment, with all dependencies pinned with verified integrity hashes.
- A simple tool to builds a single HTML file by inlining its Javascript and CSS.
- Reusable CI workflow, to be consumed by every keepass-web repository and ensure consistent builds.
- Required branch protection policy to check in every keepass-web repository.

## Docs

- [Reproducing a build](REPRODUCING.md): how to independently reproduce a versioned distributable and verify its checksum. Also covers how to update a pinned dependency.
- [Branch protection rulesets](RULESETS.md): what rules every keepass-web repository must have, and how to configure them when creating a new repo.
