# Plan 003: Use the device's local timezone for "today"

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 065fee3..HEAD -- functions/_lib.ts functions/api/bc.ts src/App.tsx src/Home.tsx src/Onboarding.tsx src/EcPanel.tsx src/BcPanel.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: MEDIUM
- **Depends on**: none (interacts with 005, which also edits `functions/_lib.ts`;
  land them sequentially, not in parallel)
- **Category**: correctness
- **Planned at**: commit `065fee3`, 2026-09-15

## Why this matters

Every "today" in this app is computed as `new Date().toISOString().slice(0, 10)`.
`toISOString()` always renders UTC. In Indonesia (the app's only locale,
`WIB` = UTC+7), that means for the first **seven hours of every local day** —
00:00 to 06:59 — the app believes it is still yesterday.

The user-visible consequences:

1. **The home screen shows the wrong day.** `buildState` computes
   `todayIso` in UTC (`functions/_lib.ts:66`) and returns it as `today`;
   `src/Home.tsx:32` renders it and labels the glance card with it. Between
   midnight and 7am, the card shows yesterday's date.
2. **Symptom logging writes to the wrong date.** `todaySymptoms` is fetched
   with the same UTC date (`functions/_lib.ts:68`), and the symptom toggle
   endpoint stores whatever `date` the client sends. A user logging cramps at
   00:30 on the 15th has them recorded on the 14th.
3. **Birth-control dose logging marks the wrong day.** `functions/api/bc.ts:20`
   computes `today` in UTC, so a dose taken at 06:00 WIB is recorded against
   yesterday's date — silently corrupting the adherence record.
4. **The onboarding default and date-input `max`** (`src/Onboarding.tsx:8,61`)
   default to yesterday for the same reason.

The root problem is that the server has no way to know the client's timezone;
it must be told. The fix is a small, explicit contract: the client sends its
local date, the server validates and uses it, falling back to UTC when absent
or malformed (so the API stays usable by `curl` and future clients).

**Do not "fix" this by changing the server to UTC+7.** The app is multi-user
and the stored dates are UTC `YYYY-MM-DD` by design (spec §7); the timezone is
a property of the *device*, not the server. A hardcoded offset would be a new
bug for any user outside WIB.

## Current state

The client date helper that already exists but is UTC (`src/App.tsx:16`):

```tsx
const today = () => new Date().toISOString().slice(0, 10);
```

`src/Home.tsx:32`, which falls back to the same UTC expression:

```tsx
const today = me.today ?? new Date().toISOString().slice(0, 10);
```

The server's date computation (`functions/_lib.ts:66-72`):

```ts
  const todayIso = new Date().toISOString().slice(0, 10);
  const { results: symptoms } = await env.DB.prepare(
    'SELECT kind FROM symptoms WHERE user_id=? AND date=?'
  ).bind(userId, todayIso).all();
```

The BC dose write (`functions/api/bc.ts:19-24`):

```ts
    const today = new Date().toISOString().slice(0, 10);
    await env.DB.prepare('DELETE FROM dose_logs WHERE user_id=? AND date=?').bind(user.id, today).run();
    await env.DB.prepare('INSERT INTO dose_logs (id,user_id,date,taken) VALUES (?,?,?,?)')
```

The other UTC-date call sites to be aware of:

- `src/Calendar.tsx:48` — `todayIso` for highlighting today in the grid.
- `src/EcPanel.tsx:8` — default intake date.
- `src/BcPanel.tsx:23` — `pack_start_date`.
- `src/Onboarding.tsx:8,61` — default last-period date and the `max` attribute.

`buildState`'s signature today (`functions/_lib.ts`, around line 50):

```ts
export async function buildState(env: any, userId: string) { ... }
```

The request object is **not** currently passed to `buildState`; it is called
from `functions/api/me.ts:9` as `buildState(env, user.id)`. You will need to
thread the request (or just the derived date) through.

Repo conventions:

- Dates are stored as UTC `YYYY-MM-DD` strings (spec §2, README "Notes").
- `src/i18n.ts` holds all user-facing strings in Indonesian; date formatting
  uses `toLocaleDateString('id-ID', ...)` with an explicit `T00:00:00Z` suffix
  on the input so the parsed instant does not shift.
- Terse code, lowercase comments, `// ponytail:` for deliberate shortcuts.

## Commands you will need

Run from the repo root. If `npm ci` fails on this machine because the repo is
on a `/storage/...` mount, read the "Environment note" in `plans/README.md` and
work in the `~/red-build` shadow directory instead.

| Purpose   | Command            | Expected on success |
|-----------|--------------------|---------------------|
| Tests     | `npx vitest run`   | all pass            |
| Typecheck | `npm run typecheck`| exit 0              |
| Build     | `npm run build`    | exit 0              |

## Scope

**In scope** (the only files you should modify or create):

- `lib/today.ts` (create) — the client-side local-date helper and the header name.
- `functions/_lib.ts` — add a `clientDate(request)` helper; use it for
  `todayIso`; thread the request into `buildState`.
- `functions/api/me.ts` — pass the request to `buildState`.
- `functions/api/bc.ts` — use `clientDate(request)` instead of UTC.
- `functions/api/symptoms.ts` — only if it independently computes a UTC date;
  read it first. If it takes `date` from the body, leave it alone.
- `src/App.tsx` — `today()` uses the new helper.
- `src/Home.tsx` — fallback uses the new helper.
- `src/Calendar.tsx` — `todayIso` uses the new helper.
- `src/Onboarding.tsx` — default and `max` use the new helper.
- `src/EcPanel.tsx`, `src/BcPanel.tsx` — defaults use the new helper.
- `lib/today.test.ts` (create)

**Out of scope** (do NOT touch):

- `lib/predict.ts`, `functions/_predict.ts`, `lib/insights.ts`,
  `functions/_insights.ts` — the prediction math is date-arithmetic on stored
  `YYYY-MM-DD` strings and does not read the wall clock. Leave it alone; plan
  005 owns those files.
- `lib/cycle.ts` — same reason.
- The database schema. No new column, no migration.
- The `symptoms` POST body shape. It already takes an explicit `date`; the
  client will now send the correct one.
- Any date *formatting* (`toLocaleDateString` calls) — those are already
  correct because they append `T00:00:00Z`.

## Git workflow

- Branch: `advisor/003-local-today`
- Commit per step. Message style from `git log --oneline` is lowercase and
  topic-prefixed, e.g. `today: use device-local date instead of UTC for
  logging, dose marks, and the glance card`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the client helper

Create `lib/today.ts`:

```ts
// The device's local calendar date as YYYY-MM-DD.
// ponytail: `toISOString()` is UTC; in WIB (UTC+7) it returns yesterday until
// 07:00 local. Build the date from the local getters instead.
export const LOCAL_DATE_HEADER = 'X-Local-Date';

export function localDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// A valid YYYY-MM-DD that is a real calendar date (rejects 2026-02-31).
export function isIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(s + 'T00:00:00Z');
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s;
}
```

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 2: Write the helper's tests

Create `lib/today.test.ts`. Because `localDate` reads the host clock, do not
assert against the real current date — pass explicit `Date` objects and assert
the local-calendar rendering. Note: `new Date(2026, 0, 15, 0, 30)` constructs
in local time, so `localDate` of it must be `'2026-01-15'` regardless of the
test machine's timezone. Cover:

- `localDate(new Date(2026, 0, 15, 0, 30))` → `'2026-01-15'` (the midnight edge
  that the UTC bug got wrong).
- `localDate(new Date(2026, 11, 31, 23, 59))` → `'2026-12-31'`.
- `localDate(new Date(2026, 0, 5, 12, 0))` → `'2026-01-05'` (zero-padding).
- `isIsoDate('2026-01-15')` → true; `isIsoDate('2026-2-5')` → false;
  `isIsoDate('2026-02-31')` → false; `isIsoDate('')` → false;
  `isIsoDate(null)` → false; `isIsoDate(20260115)` → false.

**Verify**: `npx vitest run lib/today.test.ts` → all pass.

### Step 3: Add the server-side reader

In `functions/_lib.ts`, add a helper that extracts the client's local date from
the request header, validated, falling back to UTC. Import `isIsoDate` and
`LOCAL_DATE_HEADER` from `../lib/today` — **verify this import resolves under
the Pages bundler**; if `functions/` cannot import from `lib/` (the reason
`_predict.ts` is a duplicate copy), inline the two small functions in
`functions/_lib.ts` instead and add a `// ponytail: keep in sync with
lib/today.ts` comment, exactly as `_predict.ts` does. Try the import first and
report which path you took.

```ts
// The client sends its device-local date so a WIB user logging at 00:30 is not
// recorded on yesterday's UTC date. Absent or malformed -> UTC (curl, old clients).
export function clientDate(request: Request): string {
  const raw = request.headers.get('X-Local-Date');
  return isIsoDate(raw) ? raw : new Date().toISOString().slice(0, 10);
}
```

**Verify**: `npx tsc --noEmit` → exit 0.
**Verify**: `npx vitest run` → all pass.

### Step 4: Thread the request into `buildState` and use the local date

Change `buildState` to accept the request so it can read the header:

```ts
export async function buildState(env: any, userId: string, request?: Request) {
```

Inside, replace `const todayIso = new Date().toISOString().slice(0, 10);` with
`const todayIso = request ? clientDate(request) : new Date().toISOString().slice(0, 10);`.

Update the caller `functions/api/me.ts:9` to `buildState(env, user.id, request)`.

Check every other caller of `buildState` with
`grep -rn "buildState(" functions/` and update each to pass its `request`.
Making the parameter optional keeps any missed caller compiling, but a caller
that omits it silently keeps the UTC bug — so update them all and confirm the
grep shows no remaining two-argument call.

**Verify**: `grep -rn "buildState(" functions/` → every call passes a request
(or is the definition).
**Verify**: `npx tsc --noEmit` → exit 0.

### Step 5: Fix the BC dose date

In `functions/api/bc.ts`, replace the UTC computation at line 20 with
`clientDate(request)`, importing it from `../_lib`. Confirm the handler has
`request` in scope (it destructures `{ request, env }`).

**Verify**: `grep -n "clientDate(request)" functions/api/bc.ts` → one match.
**Verify**: `grep -n "toISOString().slice(0, 10)" functions/api/bc.ts` → no matches.

### Step 6: Fix the client call sites

Update each client call site to use `localDate()` from `./today` (adjust the
relative path per file):

- `src/App.tsx:16` — `const today = () => localDate();`
- `src/Home.tsx:32` — `const today = me.today ?? localDate();`
- `src/Calendar.tsx:48` — `const todayIso = localDate();`
- `src/Onboarding.tsx:8` — `useState(() => localDate())`; and line 61 `max={localDate()}`
- `src/EcPanel.tsx:8` — `useState(localDate())`
- `src/BcPanel.tsx:23` — `pack_start_date: localDate()`

Do **not** change `src/Calendar.tsx:24`, `src/App.tsx:126`, or any
`toLocaleDateString` call — those are pure date arithmetic on stored strings,
not wall-clock reads.

**Verify**: `grep -rn "new Date().toISOString().slice(0, 10)\|new Date().toISOString().slice(0,10)" src/` → no matches.

### Step 7: Send the header from the client

The server can only use the local date if the client sends it. Find the single
place the client issues API requests. It is a plain `fetch` call per screen, so
either:

- add a tiny wrapper in `lib/today.ts` (e.g. `export const dateHeaders = () => ({ 'X-Local-Date': localDate() })`) and spread it into every `/api/` fetch's headers, or
- add a global `fetch` interceptor in `src/main.tsx` that injects the header for same-origin `/api/` requests.

**Prefer the explicit per-call header.** A global monkey-patch is harder to
audit and can surprise the service worker. But there are many call sites — if
the count is large enough that per-call headers become error-prone, the
interceptor is acceptable; state which you chose in your report.

At minimum, the calls that must send it are the ones whose server side now
reads it: `GET /api/me`, `POST /api/bc`, and any others surfaced by the
`buildState` grep in step 4. Sending it on all `/api/` requests is fine and
simpler.

**Verify**: `grep -rn "X-Local-Date\|LOCAL_DATE_HEADER\|dateHeaders" src/` →
at least the `/api/me` call site appears.

### Step 8: Full verification

**Verify**: `npm run typecheck` → exit 0.
**Verify**: `npx vitest run` → all pass.
**Verify**: `npm run build` → exit 0.

## Test plan

- New: `lib/today.test.ts` — `localDate` across midnight/month-end/padding
  edges and `isIsoDate` validation cases (step 2).
- Structural pattern: `lib/predict.test.ts` (flat `describe`/`it`, no mocks).
- The server-side `clientDate` should be covered by an assertion added to the
  plan-001 auth test harness if it has landed; otherwise rely on the
  `isIsoDate` unit tests plus manual verification.
- No existing test should need modification. If one breaks, STOP — the
  prediction tests must be untouched by this plan.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npx vitest run` exits 0
- [ ] `grep -rn "new Date().toISOString().slice(0, 10)" src/` returns nothing
- [ ] `grep -rn "buildState(" functions/` shows no two-argument call
- [ ] `grep -n "clientDate" functions/_lib.ts functions/api/bc.ts` shows both
- [ ] A `X-Local-Date` header is sent on at least the `/api/me` request
- [ ] `lib/today.test.ts` exists and covers the `00:30` midnight case
- [ ] `git status --short` shows only files listed in the Scope section
- [ ] No file listed under "Out of scope" was modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `functions/` cannot import from `lib/` under the Pages bundler and you need
  the duplicate-copy approach. Report which you chose and confirm the two
  copies of `isIsoDate` are identical.
- Threading the request through `buildState` requires changing more callers
  than the grep in step 4 finds.
- You are tempted to hardcode `UTC+7` or `Asia/Jakarta`. That is the exact bug
  this plan exists to remove — the date must come from the device.
- The client-side fetch calls turn out to be numerous enough that neither the
  per-call header nor the interceptor is clean. Report the count and the file
  list rather than refactoring the request layer.
- Any prediction or cycle test breaks.

## Maintenance notes

- The contract is: **clients may send `X-Local-Date: YYYY-MM-DD`; the server
  validates it and falls back to UTC.** Any new endpoint that needs "today"
  must call `clientDate(request)`, not `toISOString()`. A reviewer should
  reject `new Date().toISOString().slice(0, 10)` in any request handler.
- If `functions/_lib.ts` ends up duplicating `lib/today.ts` (bundler
  constraint), the two copies must change together — same rule as
  `_predict.ts`. Plan 001's drift test covers `predict`/`insights`; consider
  extending it to `today` if the duplication path is taken.
- Stored dates remain UTC `YYYY-MM-DD` (spec §7). This plan changes which
  *instant* "today" refers to, not the storage format.
- Deferred: the server cannot know the timezone for a request that omits the
  header, so a `curl` user gets UTC. That is acceptable for an API used only by
  the bundled client; document it in the README if the API is ever published.
