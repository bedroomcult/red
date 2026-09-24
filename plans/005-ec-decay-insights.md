# Plan 005: Decay EC disruption and make insights agree with the prediction

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 065fee3..HEAD -- lib/predict.ts lib/insights.ts functions/_predict.ts functions/_insights.ts functions/_lib.ts`
> If any in-scope file changed since this plan was written (in particular, if
> plan 003 already touched `functions/_lib.ts`), compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as
> a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MEDIUM (changes the numbers shown to users in two places)
- **Depends on**: 001 (the drift test must exist before both copies of
  `predict` are edited)
- **Category**: correctness
- **Planned at**: commit `065fee3`, 2026-09-15

## Why this matters

Two separate ways the app currently contradicts itself.

**1. Emergency contraception never wears off.** The spec (§5) says EC widens
the prediction for "the next 1–2 cycles" and that "next cycle normalizes".
The implementation applies the EC adjustment whenever an EC event exists
within a 60-day window:

- `functions/_lib.ts:55` builds `cutoff = now − 60d` and selects EC events
  newer than it.
- `functions/_lib.ts:60` takes the single most recent event's `ec_type` and
  passes it to `predict` as `ecType`.
- `lib/predict.ts` then applies `w = 7` (LNG) or `w = 10` (UPA), **sets
  `ov = null`**, forces `confidence = 'low'`, and pushes the `ec-disrupted`
  flag — unconditionally, with no notion of recency.

So a user who took a morning-after pill 59 days ago — two full cycles, both
since logged normally — still sees a wide prediction window, no ovulation
estimate at all, and a "EC disrupted" warning. The tool keeps alarming about an
event that has long since resolved. The spec also asks for late-detection to
be pushed out for EC (`expected + 10d`), which this flag is standing in for.

**2. The Wawasan screen and the prediction disagree.** `predict` filters
implausible cycles (`c >= 15 && c <= 60`, `lib/predict.ts:17`), keeps only the
last 6, and drops a single outlier beyond 2 SD (`lib/predict.ts:26`).
`insights` does none of that: it computes the average over every consecutive
pair of menstruation starts (`lib/insights.ts:27`), the standard deviation over
the same unfiltered set, and a `next3` projection from that raw average
(`lib/insights.ts:42`).

Concretely: a user with one mis-tapped period 45 days off will see
`predict` report a confident 28-day cycle while the Wawasan screen reports a
32-day average and projects the next three periods three days late. One of the
two screens is always wrong, and the user has no way to tell which.

The fix is to make `predict` and `insights` share one cycle-statistics routine,
so there is exactly one definition of "the user's cycles".

## Current state

`lib/predict.ts:14-30` — the statistics that `insights` fails to reuse:

```ts
  let cycles: number[] = [];
  if (estimated) {
    cycles = [fb];
    flags.push('estimated');
  } else {
    for (let i=1;i<ds.length;i++) cycles.push(Math.round((ds[i]-ds[i-1])/86400000));
    // ponytail: drop implausible cycles (mis-taps, spotting logged as period).
    // 15..60d covers real cycles; fallback to the configured length when nothing survives.
    cycles = cycles.filter(c => c >= 15 && c <= 60);
    if (!cycles.length) { cycles = [fb]; flags.push('estimated'); }
    cycles = cycles.slice(-6);
  }
  const mean = (a:number[])=>a.reduce((x,y)=>x+y,0)/a.length;
  let avg = mean(cycles);
  let sd = Math.sqrt(mean(cycles.map(c=>(c-avg)**2)));
  if (cycles.length>=4) { const out = cycles.filter(c=>Math.abs(c-avg)>2*sd); if (out.length===1) { cycles = cycles.filter(c=>c!==out[0]); avg = mean(cycles); sd = Math.sqrt(mean(cycles.map(c=>(c-avg)**2))); } }
```

`lib/insights.ts:23-42` — the divergent computation:

```ts
  const mens = periods.filter((p) => p.type === 'menstruation').sort((a, b) => a.start_date.localeCompare(b.start_date));
  const starts = mens.map((p) => parse(p.start_date));

  const lens: number[] = [];
  for (let i = 1; i < starts.length; i++) lens.push(Math.round((starts[i] - starts[i - 1]) / DAY));
  // ... plens for period lengths ...
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const avgCycle = lens.length ? Math.round(mean(lens)) : null;
  const avgPeriod = plens.length ? Math.round(mean(plens)) : null;
  const variability = lens.length >= 2 ? Math.round(Math.sqrt(mean(lens.map((c) => (c - mean(lens)) ** 2))) * 10) / 10 : null;

  const eff = avgCycle ?? fallbackCycle;
  const last = starts.length ? starts[starts.length - 1] : null;
  const next3: string[] = [];
  if (last !== null) for (let i = 1; i <= 3; i++) next3.push(iso(last + eff * i * DAY));
```

`lib/predict.ts:32-34` — the unconditional EC widening:

```ts
  let w = Math.max(Math.round(sd),2);
  if (estimated) w = 5;
  if (opts.ecType==='LNG') w = 7;
  if (opts.ecType==='UPA') w = 10;
```

`functions/_lib.ts:55-63` — the 60-day window and the newest-event shortcut:

```ts
  const cutoff = new Date(Date.now() - 60 * 864e5).toISOString();
  const { results: ec } = await env.DB.prepare(
    'SELECT id,ec_type,intake_at,upsi_at FROM ec_events WHERE user_id=? AND intake_at>? ORDER BY intake_at DESC'
  ).bind(userId, cutoff).all();
  const starts = (periods as any[]).filter((p) => p.type === 'menstruation').map((p) => p.start_date as string);
  const ecType = (ec as any[]).length ? (ec as any[])[0].ec_type : null;
```

Repo conventions: `functions/_predict.ts` is a hand-maintained copy of
`lib/predict.ts` and `functions/_insights.ts` is a copy of `lib/insights.ts`
(the Pages bundler does not resolve imports outside `functions/`), each headed
by `// Copy of ... // ponytail: keep in sync with ...`. Plan 001 adds a drift
test that compares the copies. `functions/_predict.ts` and
`functions/_insights.ts` are siblings, so `_insights.ts` **can** import from
`./_predict` — use that to remove the duplication rather than copying the new
statistics a second time.

## Commands you will need

Run from the repo root. If `npm ci` fails on this machine because the repo is
on a `/storage/...` mount, read the "Environment note" in `plans/README.md` and
work in the `~/red-build` shadow directory instead.

| Purpose   | Command                    | Expected on success |
|-----------|----------------------------|---------------------|
| Tests     | `npx vitest run`           | all pass            |
| Typecheck | `npm run typecheck`        | exit 0              |
| Build     | `npm run build`            | exit 0              |

## Scope

**In scope** (the only files you should modify or create):

- `lib/predict.ts` — export `cycleStats` and `ecDisrupts`; refactor `predict`
  to use them.
- `functions/_predict.ts` — mirror exactly.
- `lib/insights.ts` — use `cycleStats`.
- `functions/_insights.ts` — mirror, importing from `./_predict`.
- `functions/_lib.ts` — `buildState` only: apply the new EC activity rule.
- `lib/predict.test.ts` — add `cycleStats` and `ecDisrupts` cases.
- `lib/insights.test.ts` (create) — first direct tests for `insights`.

**Out of scope** (do NOT touch):

- `src/InsightsScreen.tsx` — it renders whatever `insights` returns. If its
  layout assumes `count` is the raw number of cycles, that is cosmetic; report
  it rather than editing the screen.
- `src/Home.tsx`, `src/Calendar.tsx`, `lib/cycle.ts` — they consume `predict`'s
  existing return shape, which is unchanged.
- The `ec_events` table or the `POST /api/ec` shape (`ec_type` stays
  `LNG`/`UPA`/`copper`).
- `migrations/**`.
- The 60-day SQL cutoff in `buildState`. Keep fetching the last 60 days; the
  decay decision moves into `ecDisrupts`. Narrowing the SQL would change what
  the EC history panel shows.

## Git workflow

- Branch: `advisor/005-ec-decay-insights`
- Commit per step. Message style from `git log --oneline` is lowercase and
  topic-prefixed, e.g. `ec: expire disruption once a period is logged or two
  cycles pass; insights: share predict's cycle stats`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extract `cycleStats` from `predict` (behavior-preserving)

In `lib/predict.ts`, add and export a pure function that returns the cycle
statistics `predict` currently computes inline:

```ts
// Shared cycle statistics. `insights` must use this same definition, or the
// Wawasan screen and the prediction disagree.
export function cycleStats(starts: string[], fallbackCycle = 28) {
  const ds = starts.map((s) => Date.parse(s + 'T00:00:00Z'));
  const fb = Math.min(60, Math.max(15, Math.round(fallbackCycle)));
  const estimated = ds.length < 2;
  let cycles: number[];
  if (estimated) {
    cycles = [fb];
  } else {
    cycles = [];
    for (let i = 1; i < ds.length; i++) cycles.push(Math.round((ds[i] - ds[i - 1]) / 86400000));
    // ponytail: drop implausible cycles (mis-taps, spotting logged as period).
    cycles = cycles.filter((c) => c >= 15 && c <= 60);
    if (!cycles.length) cycles = [fb];
    cycles = cycles.slice(-6);
  }
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  let avg = mean(cycles);
  let sd = Math.sqrt(mean(cycles.map((c) => (c - avg) ** 2)));
  if (cycles.length >= 4) {
    const out = cycles.filter((c) => Math.abs(c - avg) > 2 * sd);
    if (out.length === 1) {
      cycles = cycles.filter((c) => c !== out[0]);
      avg = mean(cycles);
      sd = Math.sqrt(mean(cycles.map((c) => (c - avg) ** 2)));
    }
  }
  return { ds, fb, estimated, cycles, avg, sd, range: Math.max(...cycles) - Math.min(...cycles), last: ds.length ? ds[ds.length - 1] : null };
}
```

Then rewrite `predict` to call it and keep its current output byte-identical.
The `estimated` flag and `need-more-data` early return must be preserved
exactly.

**Verify**: `npx vitest run lib/predict.test.ts` → all 8 existing tests pass
unchanged. This step must not change any output. If a test fails, you changed
behavior by accident — revert and retry.

### Step 2: Mirror `cycleStats` into `functions/_predict.ts`

Copy the function verbatim. The two files must remain line-for-line
equivalent for the shared parts.

**Verify**: `npx vitest run lib/predict.drift.test.ts` → all pass.

### Step 3: Add `ecDisrupts` and its tests

Add to `lib/predict.ts`:

```ts
// EC widens the next prediction and hides ovulation, but only while it is the
// plausible explanation for what the cycle is doing (spec §5: "next cycle
// normalizes"). It stops applying once a period has been logged after the dose,
// or once more than two cycles have passed with nothing logged.
export function ecDisrupts(ecIntakeAt: string | null, lastStart: string | null, cycleLen = 28): boolean {
  if (!ecIntakeAt) return false;
  const intake = Date.parse(ecIntakeAt);
  if (!Number.isFinite(intake)) return false;
  const len = Math.min(60, Math.max(15, Math.round(cycleLen)));
  if (lastStart) {
    const last = Date.parse(lastStart + 'T00:00:00Z');
    if (Number.isFinite(last) && last > intake) return false; // a bleed since the dose
  }
  return (Date.now() - intake) / 86400000 <= 2 * len;
}
```

Add cases to `lib/predict.test.ts`. Because `ecDisrupts` reads the clock, pass
intake dates *relative to now* so the tests stay stable:

- intake 3 days ago, no period since → `true`
- intake 3 days ago, a period started 1 day ago → `false`
- intake 60 days ago with `cycleLen = 28` (2 cycles = 56 days) → `false`
- intake 40 days ago with `cycleLen = 28` → `true`
- intake 40 days ago with `cycleLen = 15` (2 cycles = 30 days) → `false`
- `ecDisrupts(null, '2026-01-01')` → `false`
- `ecDisrupts('not-a-date', '2026-01-01')` → `false`
- a period started before the dose does **not** clear it: intake 3 days ago,
  lastStart 10 days ago → `true`

Build the relative dates with a local helper in the test file, e.g.
`const ago = (d: number) => new Date(Date.now() - d * 864e5).toISOString();`

**Verify**: `npx vitest run lib/predict.test.ts` → all pass, including the new
cases.
**Verify**: `npx vitest run lib/predict.drift.test.ts` → all pass.

### Step 4: Mirror `ecDisrupts` into `functions/_predict.ts`

Verbatim copy.

**Verify**: `npx vitest run lib/predict.drift.test.ts` → all pass.

### Step 5: Rewrite `lib/insights.ts` to use `cycleStats`

Replace the inline statistics with `cycleStats(starts, fallbackCycle)`:

- `avgCycle` = `Math.round(stats.avg)` when there is at least one real logged
  cycle, else `null`. Preserve today's contract that a user with zero or one
  period gets `avgCycle: null` (the screen prints a fallback message) — so gate
  on `starts.length >= 2`, not on `stats.cycles.length`.
- `variability` = the SD from `cycleStats`, rounded to one decimal, when at
  least two cycles exist, else `null`.
- `shortest`/`longest` = min/max of `stats.cycles` (only when real cycles
  exist), so they exclude the implausible cycles the old code counted.
- `count` = the number of cycles in `stats.cycles`. **This is a behavior
  change** — it previously counted unfiltered cycles. Note it in your report
  so the screen's copy can be reviewed.
- `next3` = `last + avg * i` for `i` in 1..3, using `stats.avg` when real
  cycles exist and `fallbackCycle` otherwise. Round to whole days.
- `avgPeriod` is unchanged: it is about period *lengths*, which `predict` does
  not model. Keep the existing `plens` computation, including the
  `+ 1` inclusive-day count.

Update the file's header comment to note that the cycle statistics now come
from `predict.ts` so the two screens cannot diverge.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 6: Create `lib/insights.test.ts`

The existing tests only cover this file indirectly through the drift test.
Add direct cases:

- Empty input → `{ avgCycle: null, avgPeriod: null, variability: null, count: 0, shortest: null, longest: null, next3: [] }`.
- One period → `avgCycle: null`, `count: 0`, and `next3` still projects three
  dates from the fallback cycle.
- Three regular periods (the existing self-check fixture: `2026-01-01`,
  `2026-01-29`, `2026-02-26` with ends) → `avgCycle: 28`, `count: 2`,
  `variability: 0`, `next3[0] === '2026-03-26'`, `avgPeriod: 5`.
- **The regression case this plan exists for:** three regular periods plus one
  implausible outlier (`2026-03-20`, a 22-day hole, then back on track). Assert
  `avgCycle` is unchanged from the regular-only value and that the outlier is
  excluded from `shortest`/`longest`. Construct the fixture so the outlier
  would visibly move the average under the old code, then confirm it does not
  under the new one.
- A case where `insights` and `predict` must agree: for one fixture, assert
  `next3[0]` equals `predict(starts, {}).next`. This is the anti-divergence
  assertion, and it is the most valuable test in the file.

**Verify**: `npx vitest run lib/insights.test.ts` → all pass.

### Step 7: Mirror into `functions/_insights.ts`

Update `functions/_insights.ts` to import `{ cycleStats }` from `./_predict`
and use it, so the statistics exist in exactly one place server-side too.

**Verify**: `grep -n "from './_predict'" functions/_insights.ts` → one match.
**Verify**: `npx vitest run lib/predict.drift.test.ts` → all pass.

### Step 8: Apply the decay rule in `buildState`

In `functions/_lib.ts`, import `ecDisrupts` from `./_predict` and replace the
newest-event shortcut:

```ts
  const starts = (periods as any[]).filter((p) => p.type === 'menstruation').map((p) => p.start_date as string);
  const lastStart = starts.length ? starts[starts.length - 1] : null;
  const cycleLen = profile?.cycle_len ?? 28;   // note: `profile` is loaded below today — see below
```

Ordering matters: the current code computes `ecType` (line 60) **before** the
profile query (lines 61-63). Reorder so the profile is loaded first, then:

```ts
  const newest: any = (ec as any[])[0] ?? null;
  const ecType = newest && ecDisrupts(newest.intake_at, lastStart, cycleLen) ? newest.ec_type : null;
```

Leave the `ec` array itself untouched in the returned state — the EC history
panel still shows it, and only the *prediction input* changes.

If plan 003 has landed, `buildState` already takes a `request` parameter; keep
that signature. The two plans touch different lines of the same function, so
land 003 first and rebase this change on top.

**Verify**: `grep -n "ecDisrupts" functions/_lib.ts` → one match.
**Verify**: `npx tsc --noEmit` → exit 0.

### Step 9: Full verification

**Verify**: `npm run typecheck` → exit 0.
**Verify**: `npx vitest run` → all pass.
**Verify**: `npm run build` → exit 0.

## Test plan

- New: `lib/insights.test.ts` — empty/one/three-period cases, the outlier
  exclusion case, and the `insights.next3[0] === predict().next` agreement case.
- Extended: `lib/predict.test.ts` — eight `ecDisrupts` cases (step 3).
- Unchanged and must keep passing: `lib/predict.test.ts`'s existing 8 cases,
  `lib/cycle.test.ts`'s 19 cases, and `lib/predict.drift.test.ts` from plan 001.
  Step 1 in particular must be provably behavior-preserving; its gate is
  "every pre-existing predict test passes without edit".
- Manual check worth doing after deploy: log an EC event, confirm the banner
  and wide window appear; then log a period, reload, and confirm the banner is
  gone and a normal-width prediction is back.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npx vitest run` exits 0
- [ ] All 8 pre-existing `lib/predict.test.ts` cases pass **without
      modification** (proves step 1 preserved behavior)
- [ ] `grep -c "export function cycleStats" lib/predict.ts functions/_predict.ts` prints `1` and `1`
- [ ] `grep -c "export function ecDisrupts" lib/predict.ts functions/_predict.ts` prints `1` and `1`
- [ ] `grep -n "from './_predict'" functions/_insights.ts functions/_lib.ts` shows both imports
- [ ] `grep -n "ecDisrupts" functions/_lib.ts` shows the rule is applied
- [ ] `lib/insights.test.ts` exists and contains an assertion equating
      `insights().next3[0]` with `predict().next`
- [ ] `git status --short` shows only files listed in the Scope section
- [ ] No file listed under "Out of scope" was modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any pre-existing test fails after step 1. `cycleStats` must be a pure
  extraction; a failure means the refactor changed behavior, and the fix is to
  correct the extraction, never to edit the test.
- `functions/_insights.ts` cannot import from `./_predict`. It should be able
  to (same directory), but if the bundler rejects it, fall back to duplicating
  `cycleStats` in `_insights.ts` with the usual `// ponytail: keep in sync`
  header, and **extend the drift test in plan 001 to compare `cycleStats`
  directly** so the copy is guarded.
- The `insights` behavior change to `count` breaks `src/InsightsScreen.tsx`'s
  rendering (for example the copy reads "dari N siklus" against a number that
  no longer matches what the user logged). Report it; do not edit the screen
  from this plan.
- You are tempted to also implement the spec's EC late-threshold change
  (`expected + 10d`). That is a separate feature; this plan only stops the EC
  adjustment from persisting forever.
- The decay rule you need is more complex than "a bleed since the dose, or
  more than two cycles". Report the case that breaks it rather than growing the
  rule.

## Maintenance notes

- **`cycleStats` is now the single definition of the user's cycle statistics.**
  Any future change to outlier handling, the 15–60 day plausibility band, or
  the last-6-cycles window must be made in `lib/predict.ts` and mirrored in
  `functions/_predict.ts`, and it will propagate to `insights` on both sides
  automatically. Do not reintroduce a second statistics computation.
- The `insights.next3[0] === predict().next` assertion is the guard against the
  two screens diverging again. Keep it when editing either function.
- `ecDisrupts` reads `Date.now()`. That makes it the only non-deterministic
  function in `lib/predict.ts`; the tests use dates relative to now for that
  reason. If a future test needs a fixed clock, pass the "now" instant in as a
  parameter rather than mocking the global clock.
- The 60-day EC SQL cutoff in `buildState` is now only a history-fetch bound,
  not the decay rule. Tightening it would change the EC history panel; the
  decay decision belongs in `ecDisrupts`.
- Spec §5's late-threshold extension (no-bleed alarm at `expected + 10d` for
  EC rather than `+7d`) remains unimplemented. There is currently no late
  alarm at all — `Home.tsx` renders an overdue state from `daysToNext < 0`.
  That gap is a feature, not a regression from this plan.
