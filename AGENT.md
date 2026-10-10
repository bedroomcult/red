# AGENT.md — Release process for Red

Instructions for any AI agent cutting a release. Follow in order. Do not
skip steps. The CI enforces the rules below; violating them wastes a
20-minute build cycle.

## 0. Decide the version

- Read `package.json` → current `X.Y.Z`.
- `X` = big updates, `Y` = finalized updates, `Z` = small changes.
- Bump exactly one segment. Never invent a fourth segment, suffix, or
  `v<run_number>` scheme — `check-release-version.mjs` rejects all of them.

## 1. Verify the tree is releasable

```bash
git status --short        # must be empty (commit or stash first)
git log --oneline -5      # confirm the commits you intend to ship
```

- All intended changes must already be on `main` with CI `build` green.
- Never release from a dirty tree or a feature branch.

## 2. Bump the version

```bash
# Replace OLD with the current version, NEW with the bumped version:
sed -i 's/"version": "OLD"/"version": "NEW"/' package.json package-lock.json
git add package.json package-lock.json
git commit -m "vNEW: <one-line summary>"
git push origin main
```

- Both files, same version, one commit. `package-lock.json` has the
  version in two places (`sed` without `g` hits only the first — check
  with `grep '"version"' package-lock.json` and fix the second by hand
  if needed).

## 3. Wait for main CI, then tag

- Wait for the `main` push CI run: `build` must be `success`.
  (`version`/`apk` jobs are tag-only and will show `skipped` — expected.)
- Only then:

```bash
git tag vNEW
git push origin vNEW
```

- Tag name must be exactly `v` + `package.json` version. A mismatch fails
  `check-release-version.mjs` and blocks the release.
- If you must move a tag (CI failed on the tagged commit), use
  `git tag -f vNEW && git push origin vNEW --force` — then say so loudly.

## 4. Wait for the tag CI, verify the APK

```bash
# Poll until all jobs conclude (up to ~5 min):
gh run view $(gh run list --limit 1 --json databaseId --jq '.[0].databaseId') \
  --json jobs --jq '.jobs[] | "\(.name): \(.conclusion)"'
gh release view vNEW --json assets --jq '.assets[]?.name'
```

- Expected: `build: success`, `version: success`, `apk: success`,
  asset `red-NEW.apk` present.

## 5. Write the release notes

- Path: `docs/releases/vNEW.md`.
- Template:

```markdown
# Release vNEW — <short title>

**Tag:** `vNEW` · **Commits:** `<sha7>`, `<sha7>` · **Follows:** vPREV

## What changed

<One paragraph of context. Then a table:>

| Component | Change |
|---|---|
| `FileOrArea` | What changed, in one line |

## Why

<Root cause or user need, 2-4 sentences. Link the pattern, not just
the symptom.>

## Failure surface / risks

<What can still go wrong, and where the user sees it. If nothing,
say what was deliberately left blocking and why.>

## What stayed blocking (deliberate)

<Paths intentionally NOT converted / changed, with one-line reasons.
Delete this section if everything moved.>

## Verify

<Numbered steps the user runs on-device with the APK. Concrete:
which screen, which tap, what success looks like.>
```

- Rules for the notes:
  - Name files, functions, and keys exactly (`LogSheet`, `onSyncFail`,
    `pt.lockPin`) — the reader greps with them.
  - State what did NOT change when the diff could imply otherwise.
  - Keep Verify to 3 steps max, each doable in under 2 minutes.
- Commit and push separately from the version bump (keeps the release
  commit clean for `git log --oneline -- package.json` archaeology):

```bash
git add docs/releases/vNEW.md
git commit -m "Docs: vNEW release notes"
git push origin main
```

- Docs commits do not need a tag and do not trigger a release build.

## 6. Report to the user

One line per item, no preamble:

- Version + tag, CI jobs and conclusions, APK asset name.
- One-line summary of what shipped.
- One concrete next action (install APK, test path, ~minutes).

## Anti-patterns (from real failures)

- Tagging before main CI is green → tag points at a red commit, must
  force-move (noisy, confuses `gh release view` caching).
- Forgetting `package-lock.json`'s second version field → version job
  fails, whole release blocks.
- Writing notes before the tag CI finishes → Verify section promises an
  APK that does not exist yet.
- `gh release view` immediately after push → GitHub caches "release not
  found"; wait 60-90s and retry before concluding failure.
- `sleep` + `gh run view` in one long command → tool timeouts; poll in
  two steps (150s then 90s) as in step 4.
