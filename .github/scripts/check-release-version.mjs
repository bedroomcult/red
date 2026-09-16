// Guards the release versioning rules (see CONTRIBUTING or the release section
// of README.md):
//   X = big updates, Y = finalized updates, Z = small changes
//   - package.json version must be strict X.Y.Z
//   - the tag pushed for that version is exactly vX.Y.Z
//   - every release tag in the repo must be strict vX.Y.Z, no v<run_number>
// Run in CI before any release step.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const errors = [];

if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) {
  errors.push(`package.json version "${pkg.version}" is not strict X.Y.Z`);
}

const expectedTag = 'v' + pkg.version;
const ref = process.env.GITHUB_REF || '';
if (ref.startsWith('refs/tags/')) {
  const tag = ref.slice('refs/tags/'.length);
  if (tag !== expectedTag) {
    errors.push(`tag "${tag}" does not match package.json version (expected "${expectedTag}")`);
  }
}

// Only tags that exist as git tags; releases are created with tags, so this
// catches the old v<run_number> scheme.
let tags = [];
try {
  tags = execSync('git tag --list', { encoding: 'utf8' }).split('\n').filter(Boolean);
} catch {
  // No tags / shallow clone: not fatal.
}
for (const tag of tags) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) errors.push(`tag "${tag}" is not vX.Y.Z`);
}

if (errors.length) {
  console.error('release-version check failed:');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`release version ok: ${pkg.version} (tag ${expectedTag})`);
