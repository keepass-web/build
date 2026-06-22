// @ts-check
/**
 * Validates that the default branch of the current repository has all required
 * branch protection rules active. Reads the expected rule types from
 * expected.json and compares them against the rules returned by the GitHub API.
 *
 * Requires: gh CLI authenticated via GITHUB_TOKEN (available in Actions).
 * Exits 0 on success, 1 on failure.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));

/** @type {{ required_rule_types: string[] }} */
const expected = JSON.parse(readFileSync(join(dir, 'expected.json'), 'utf8'));

const repo = process.env.GITHUB_REPOSITORY;
if (!repo) {
  process.stderr.write('GITHUB_REPOSITORY is not set.\n');
  process.exit(1);
}

// Fetch the default branch name.
let defaultBranch;
try {
  defaultBranch = execSync(`gh api repos/${repo} --jq '.default_branch'`, {
    encoding: 'utf8',
  }).trim();
} catch (err) {
  process.stderr.write(`Failed to fetch repository metadata: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}

// Fetch the effective rules for the default branch.
// This endpoint returns the merged set of all active ruleset rules applying to
// the branch — regardless of how many rulesets contribute them.
let rules;
try {
  const json = execSync(`gh api repos/${repo}/rules/branches/${defaultBranch}`, {
    encoding: 'utf8',
  });
  rules = /** @type {{ type: string }[]} */ (JSON.parse(json));
} catch (err) {
  process.stderr.write(
    `Failed to fetch rules for ${repo}/${defaultBranch}: ${err instanceof Error ? err.message : String(err)}\n`,
  );
  process.exit(1);
}

const present = new Set(rules.map((r) => r.type));
const missing = expected.required_rule_types.filter((t) => !present.has(t));

if (missing.length > 0) {
  process.stderr.write(
    `Branch '${defaultBranch}' is missing required rules: ${missing.join(', ')}\n` +
      'Import ruleset/ruleset.json from keepass-web/build via Settings → Rules → Rulesets → Import and re-run CI.\n',
  );
  process.exit(1);
}

process.stdout.write(
  `All required rules are active on '${defaultBranch}': ${expected.required_rule_types.join(', ')}\n`,
);
