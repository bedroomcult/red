# Plan 001: Establish an API + cross-copy verification baseline

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 065fee3..HEAD -- lib/predict.ts lib/insights.ts functions/_predict.ts functions/_insights.ts functions/_lib.ts functions/api/auth.ts package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `065fee3`, 2026-09-15

## Why this matters

The repo has 27 passing unit tests, all of them covering pure date math in
`lib/`. Three things are completely unverified:

1. **The auth path.** `functions/api/auth.ts` is the security-critical
   endpoint (password hashing, session issuance, rate limiting) and has zero
   test coverage.
2. **The duplication between `lib/` and `functions/`.** `lib/predict.ts` and
   `functions/_predict.ts` are two hand-maintained copies of the same
   algorithm, as are `lib/insights.ts` and `functions/_insights.ts`. The
   prediction is computed client-side and server-side, so if they diverge the
   app shows one answer and stores another. Nothing currently detects drift.
3. **The absence of a `typecheck` script.** `npm run build` runs `tsc && vite
   build`, so there is no way to typecheck without also producing a bundle.

Landing this first means every later plan (004 changes auth behavior, 005
changes both copies of the prediction) has a regression net and cannot
silently break either the security path or the client/server agreement.

## Current state

Files and their roles:

- `lib/predict.ts` — prediction engine, used by the React client. Exports
  `predict(starts, opts)`.
- `functions/_predict.ts` — byte-for-byte copy of the above with a leading
  comment explaining why it exists. Exports the same `predict`.
- `lib/insights.ts` / `functions/_insights.ts` — the same duplication pattern
  for cycle statistics. Both export `insights(periods, fallbackCycle,
  fallbackPeriod)`.
- `functions/_lib.ts` — auth helpers. Exports `hashPw`, `uid`, `getCookie`,
  `sessCookie`, `rateLimited`, `buildState`, `requireUser`.
- `functions/api/auth.ts` — the `/api/auth` handler. Exports
  `onRequestPost({ request, env })`.
- `lib/predict.test.ts` / `lib/cycle.test.ts` — the existing tests. Use these
  as the structural pattern.

The header of the server-side copy, as it exists today (`functions/_predict.ts:1-3`):

```ts
// Copy of lib/predict.ts for Pages Functions (functions/ must be self-contained —
// the Pages bundler does not resolve imports outside functions/).
// ponytail: keep in sync with lib/predict.ts; extract to shared package if they diverge.
```

Existing test style (`lib/predict.test.ts:1-9`) — match it exactly:

```ts
import { describe, it, expect } from 'vitest';
import { predict } from './predict';
describe('predict', () => {
  it('avgs 28,28,31 -> next Apr27 window ±2 high', () => {
    const r = predict(['2026-01-01','2026-01-29','2026-02-26','2026-03-29'], {});
    expect(r.next).toBe('2026-04-27');
    expect(r.confidence).toBe('high');
  });
```

The auth handler's persistence calls, as they exist today
(`functions/api/auth.ts:26-56`, abridged to the calls the shim must support):

```ts
if (action === 'logout') {
  const token = getCookie(request, 'sess');
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token=?').bind(token).run();
  return new Response('{}', { headers: { ..., 'Set-Cookie': sessCookie('', true) } });
}
// signup:
await env.DB.prepare('INSERT INTO users (id,email,pass_hash,salt,created_at) VALUES (?,?,?,?,?)')
  .bind(id, email.toLowerCase(), pass_hash, salt, new Date().toISOString()).run();
await env.DB.prepare('INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)')
  .bind(token, id, new Date(Date.now() + 30 * 864e5).toISOString()).run();
// login:
const user: any = await env.DB.prepare('SELECT id,pass_hash,salt FROM users WHERE email=?')
  .bind(email.toLowerCase()).first();
```

Note the exact call surface the fake must provide: `DB.prepare(sql)` returning
an object with `.bind(...args)`, and on that bound object `.first()`, `.all()`,
and `.run()` where `.run()` resolves to `{ meta: { changes: number } }`.

Repo conventions to match:

- Tests are colocated with the code they test (`lib/predict.test.ts` sits next
  to `lib/predict.ts`) and use `describe`/`it`/`expect` from `vitest`. There is
  no `vitest.config.ts`; Vitest's default include glob
  (`**/*.{test,spec}.?(c|m)[jt]s?(x)`) already picks up files in `functions/`.
- Comments in this repo are lowercase and often marked `// ponytail:` when they
  record a deliberate shortcut. The source is written in a terse style —
  match it, do not reformat surrounding code.
- No lint or formatter is configured. Do not add one.

## Commands you will need

Run these from the repo root. If `npm ci` fails on this machine because the
repo is on a `/storage/...` mount, read the "Environment note" in
`plans/README.md` and work in the `~/red-build` shadow directory instead — the
commands are identical there.

| Purpose   | Command                     | Expected on success        |
|-----------|-----------------------------|----------------------------|
| Install   | `npm ci`                    | exit 0                     |
| Typecheck | `npx tsc --noEmit`          | exit 0, no errors          |
| Tests     | `npx vitest run`            | all pass                   |

## Scope

**In scope** (the only files you should modify or create):

- `test/d1-shim.ts` (create)
- `functions/api/auth.test.ts` (create)
- `functions/_lib.test.ts` (create)
- `lib/predict.drift.test.ts` (create)
- `package.json` (add the `typecheck` script only)

**Out of scope** (do NOT touch, even though they look related):

- `functions/api/auth.ts` — this plan adds tests around existing behavior.
  Changing the auth logic is plan 004's job, and doing it here would remove the
  baseline this plan exists to create. The expected behaviors below are the
  *current* behaviors, including the ones 004 will later change; write the
  assertions to match what the code does today.
- `functions/_predict.ts`, `functions/_insights.ts`, `lib/insights.ts` — the
  drift test compares them; do not edit either side to make it pass. If the
  drift test fails, that is a STOP condition and a real finding.
- `lib/predict.ts` — same reason.
- `tsconfig.json` — its `include` already covers `src`, `lib`, `functions`, and
  the two config files, so new test files under `functions/` are typechecked
  automatically. Do not add `test/` to `include` unless the typecheck in step 5
  actually fails because of it.

## Git workflow

- Branch: `advisor/001-verification-baseline`
- Commit per step. Message style observed in `git log --oneline` is a short
  lowercase imperative summary with no prefix, e.g. `ovulation: clamp to day-8
  floor on short cycles; single-date staleness (fixes missing fertile window)`.
  Match that: lowercase, colon-prefixed scope when a topic word helps.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the `typecheck` script

In `package.json`, add to `scripts`:

```json
"typecheck": "tsc --noEmit"
```

Leave `build` as it is (`tsc && vite build`).

**Verify**: `npm run typecheck` → exit 0, no output.

### Step 2: Write the cross-copy drift test

Create `lib/predict.drift.test.ts`. It imports both copies and asserts they
agree on every input in a table. Use `toEqual` on the whole returned object so
any field added to one side later is caught.

The inputs must cover the branches that exist in `predict`: the EC branch
(`ecType` `'LNG'` and `'UPA'`), the BC branch (`bcMode: true`), the
single-period `estimated` branch, the implausible-cycle drop, an irregular
cycle set (`range > 9` pushes the `irregular` flag), and the short-cycle
ovulation clamp (`starts` 18 days apart).

Structure:

```ts
import { describe, it, expect } from 'vitest';
import { predict as clientPredict } from './predict';
import { predict as serverPredict } from '../functions/_predict';
import { insights as clientInsights } from './insights';
import { insights as serverInsights } from '../functions/_insights';

const PREDICT_CASES: { name: string; starts: string[]; opts: any }[] = [ /* ... */ ];

describe('lib/predict.ts and functions/_predict.ts stay in sync', () => {
  for (const c of PREDICT_CASES) {
    it(c.name, () => {
      expect(serverPredict(c.starts, c.opts)).toEqual(clientPredict(c.starts, c.opts));
    });
  }
});

describe('lib/insights.ts and functions/_insights.ts stay in sync', () => {
  // same shape, over one empty array and one 3-period array
});
```

**Verify**: `npx vitest run lib/predict.drift.test.ts` → all pass. If any case
fails, STOP — the two copies have already diverged.

### Step 3: Write the pure-helper tests

Create `functions/_lib.test.ts` covering `hashPw`, `getCookie`, `sessCookie`.

- `hashPw` is async and uses WebCrypto (`crypto.subtle`), available as a
  Node 20 global; no setup needed. Assert: the same `(pw, salt)` twice yields
  the same digest; different salts yield different digests for the same
  password; the output is base64 and non-empty.
- `getCookie(request, 'sess')` takes a `Request`. Build one with
  `new Request('https://example.com/', { headers: { Cookie: 'a=1; sess=abc' } })`.
  Assert it returns `'abc'`, and returns `null` when the header is absent and
  when the name is absent from the header.
- `sessCookie('tok')` returns a string containing `HttpOnly`, `SameSite=Lax`,
  and `Secure`, and starting with `sess=tok`. `sessCookie('', true)` returns a
  string containing `Max-Age=0`.
- `rateLimited(ip)` allows the first 10 calls for a fresh IP and returns `true`
  on the 11th. Use a unique IP string per test so the module-level map from a
  previous test cannot leak in.

**Verify**: `npx vitest run functions/_lib.test.ts` → all pass.

### Step 4: Write the in-memory D1 shim

Create `test/d1-shim.ts`. It provides the exact subset of the D1 API that
`functions/api/auth.ts` uses, backed by plain objects.

Requirements:

- Export `makeDb()` returning an object with a `prepare(sql)` method.
- `prepare(sql)` returns an object with `.bind(...args)` (returning an object
  with `.first()`, `.all()`, `.run()`) and, for parity, the same three methods
  directly on the unbound object.
- `.first()` resolves to the matching row object or `null`. `.all()` resolves
  to `{ results: [...] }`. `.run()` resolves to `{ meta: { changes: n } }`.
- Support only the statements the auth handler issues. Match on the SQL prefix
  (`INSERT INTO users`, `SELECT id,pass_hash,salt FROM users WHERE email=?`,
  `INSERT INTO sessions`, `DELETE FROM sessions WHERE token=?`).
- **Unknown SQL must throw**, not return empty data. A permissive fake would
  let a genuinely broken query pass the suite silently.
- Seed table storage as module-level state inside `makeDb()` so each test gets a
  clean database.

Include this file with a short header comment stating it is a test-only shim
for the four statements the auth handler uses, and that any new query in
`functions/api/auth.ts` must be added here or the tests will throw.

**Verify**: `npx tsc --noEmit` → exit 0. (The shim has no tests of its own yet;
it is exercised in step 5.)

### Step 5: Write the auth handler tests

Create `functions/api/auth.test.ts`. Call the handler directly:

```ts
import { onRequestPost } from './auth';

const post = (body: unknown, ip = '1.2.3.4') =>
  new Request('https://example.com/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(body),
  });
```

Assert the **current** behavior (do not "fix" anything you find):

1. `{ action: 'signup', email, password }` with a 8+ character password returns
   200, `{ ok: true }`, and a `Set-Cookie` response header containing `sess=`.
2. Signing up the same email again returns 409 with
   `{ error: 'email taken' }`.
3. A password shorter than 8 characters returns 400 with
   `{ error: 'password min 8 chars' }`, and no user row is created.
4. Missing email or password returns 400 with
   `{ error: 'email+password required' }`.
5. A malformed JSON body returns 400 with `{ error: 'bad json' }`.
6. `{ action: 'login' }` with correct credentials returns 200 and sets a
   cookie; with a wrong password returns 401 `{ error: 'invalid login' }`; with
   an unknown email returns 401 `{ error: 'invalid login' }`.
7. `{ action: 'login' }` after a successful signup works regardless of the
   case of the email used at login (the handler lowercases both sides).
8. `{ action: 'logout' }` with a valid `sess` cookie returns 200 and a
   `Set-Cookie` containing `Max-Age=0`, and removes the session from the shim.
9. `{ action: 'nonsense' }` returns 400 `{ error: 'unknown action' }`.
10. The 11th request from the same `CF-Connecting-IP` returns 429
    `{ error: 'too many attempts' }`. Use a fresh IP string for this test.

Give each test a fresh database by calling `makeDb()` in a `beforeEach` and
constructing `env` as `{ DB: db }`.

**Verify**: `npx vitest run functions/api/auth.test.ts` → all pass.

### Step 6: Run the whole suite and typecheck

**Verify**: `npm run typecheck` → exit 0.
**Verify**: `npx vitest run` → all pass, including the 27 pre-existing tests and
every new file.

## Test plan

- New: `lib/predict.drift.test.ts` — client/server agreement for `predict` and
  `insights` across the branch table listed in step 2.
- New: `functions/_lib.test.ts` — `hashPw`, `getCookie`, `sessCookie`,
  `rateLimited`.
- New: `test/d1-shim.ts` — test-only in-memory D1 subset, throwing on unknown SQL.
- New: `functions/api/auth.test.ts` — the 10 behaviors listed in step 5.
- Structural pattern to follow: `lib/predict.test.ts` (flat `describe`/`it`,
  one assertion focus per test, no mocks beyond the shim).
- No existing test should need modification. If one breaks, STOP.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npx vitest run` exits 0 and the suite contains at least 37 tests
      (27 pre-existing + at least 10 new)
- [ ] `test -f test/d1-shim.ts && test -f functions/api/auth.test.ts && test -f functions/_lib.test.ts && test -f lib/predict.drift.test.ts` exits 0
- [ ] `grep -n '"typecheck"' package.json` returns one match
- [ ] `git status --short` shows only files listed in the Scope section
- [ ] No file listed under "Out of scope" was modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The drift test in step 2 fails. That means `functions/_predict.ts` or
  `functions/_insights.ts` has already diverged from its `lib/` counterpart.
  Do not "fix" either copy — report which fields differ and let the operator
  decide (plan 005 changes both copies and needs to know).
- The code at the locations in "Current state" doesn't match the excerpts.
- The auth handler issues a SQL statement the shim does not handle. Report the
  statement rather than loosening the shim's unknown-SQL guard.
- A step's verification fails twice after a reasonable fix attempt.
- You conclude the auth handler's *current* behavior is wrong (for example the
  password comparison at `functions/api/auth.ts:71` is a plain `!==` on base64
  strings, which is not a constant-time comparison). That is already known and
  is plan 004's scope. Assert today's behavior and leave it alone.

## Maintenance notes

- The drift tests are the mechanism that makes the `lib/` ↔ `functions/`
  duplication safe. Any future edit to either copy of `predict` or `insights`
  must keep both sides in sync or the suite fails — that is the point. If the
  duplication is ever collapsed (for example by a build step that copies
  `lib/` into `functions/`), delete the drift tests in the same change.
- `test/d1-shim.ts` deliberately throws on unknown SQL. When plan 004 adds a
  statement to `functions/api/auth.ts`, it must extend the shim in the same
  commit. A reviewer should check that the shim's guard was not weakened.
- `rateLimited` is module-level state. If tests ever run concurrently within
  one worker, per-test unique IP strings (as specified) remain the only thing
  keeping the rate-limit test deterministic.
- Deferred: browser-level or end-to-end tests. The spec (§8) asked for one
  e2e covering signup → log 3 periods → prediction; that needs a running
  Workers/Miniflare environment and is why it is not in this plan.
