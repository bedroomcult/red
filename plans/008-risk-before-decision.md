# Plan 008: Show fertile risk before logging sex, unhide symptoms in all phases

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f8c4062..HEAD -- src/DaySheet.tsx src/Home.tsx`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (UX-misleading)
- **Planned at**: commit `f8c4062`, 2026-09-24

## Why this matters

Two pieces of UI inform the user only after the decision they should inform:

1. The fertile-day warning badge (`sexFertileWarn`) in the sex modal renders
   only when `sexLocal` is set — i.e. after the user already logged sex. A
   risk signal that appears post-decision is commentary, not guidance.
2. The home-screen symptom chips render only for `period`, `pms`, and
   `neutral` phases. Symptom logging is phase-independent data entry; hiding
   it during the fertile window loses the exact days cycle research cares
   about, with no explanation.

## Current state

- `src/DaySheet.tsx` — sex modal (~line 440):
    ```tsx
    {sexLocal && inFertile && (
      <div className="day-info-sub" ...><span className="badge">{t.sexFertileWarn}</span></div>
    )}
    ```
  `inFertile` is already computed (~line 190: ovulation −5d..+1d; the same
  window `lib/cycle.ts` and the calendar's `ovSet` use). The card
  preview (~line 350) has the same `sexLocal &&` guard — that one is correct
  (it summarizes what is logged) and stays.
- `src/Home.tsx` (~line 132):
    ```tsx
    {(st.phase === 'period' || st.phase === 'pms' || st.phase === 'neutral') && (
      <div className="card">
        <h2>{t.homeSymptomsToday}</h2>
    ```
  The `toggle()` handler and `SYMPTOMS` list are phase-independent already.
- Copy exists: `t.sexFertileWarn`, `t.homeSymptomsToday`,
  `t.homeSymptomHint` in `src/i18n.ts`. No new copy needed.
- Repo conventions: the sex modal already imports everything it needs; the
  Home card needs no prop changes.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Watch CI | `gh run list --branch <branch> --limit 2` | `completed success` on the `ci` workflow |

## Scope

**In scope** (the only files you should modify):
- `src/DaySheet.tsx` (sex modal badge condition only)
- `src/Home.tsx` (symptom card condition only)
- `test/ovulation.test.ts` (regression assertions)

**Out of scope** (do NOT touch):
- The sex card preview guard (`sexLocal && inFertile` in the grid) — correct as-is.
- The fertile-window math (`inFertile`, `ovSet`, `lib/cycle.ts`) — correct as-is.
- Any API, lib, or i18n change. No new copy.

## Git workflow

- Branch: `advisor/008-risk-before-decision`
- Commit message style: short imperative, e.g. `daysheet+home: show risk and symptoms upfront` (see `git log --oneline -5`).
- Do NOT push except to let CI verify, and only if the operator explicitly asks.

## Steps

### Step 1: Warn before the sex log, not after

In `src/DaySheet.tsx` sex modal, change the badge condition from
`sexLocal && inFertile` to `inFertile` so the warning shows whenever the date
is in the fertile window, logged or not. Keep the summary preview in the card
grid unchanged.

**Verify**: `grep -n "sexFertileWarn" src/DaySheet.tsx` shows two sites — the
preview (still guarded by `sexLocal`) and the modal (guarded by `inFertile`
only).

### Step 2: Show home symptoms in every phase

In `src/Home.tsx`, remove the phase guard so the symptom card always renders.
If the team wants phase-specific hints later, the hint string is the place —
not visibility. Keep the `toggle()` logic untouched.

**Verify**: `grep -n "homeSymptomsToday" src/Home.tsx` shows no surrounding
phase condition.

### Step 3: Regression tests + CI

Add source-reading assertions to `test/ovulation.test.ts` (existing style):
the sex modal references `inFertile` without requiring `sexLocal`; the Home
symptom card has no phase gate. Then push the branch (only with operator
approval) and run `gh run list --branch advisor/008-risk-before-decision
--limit 2` until `completed success`.

## Test plan

- New assertions in `test/ovulation.test.ts` for both conditions.
- Manual (reviewer): fertile date with no sex log → sex modal shows the
  warning before any tap; home screen during fertile/ovulation shows symptom
  chips and toggles persist.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] CI `ci` workflow on the branch is `completed success`
- [ ] Sex modal badge renders on `inFertile` alone; card preview still requires `sexLocal`
- [ ] Home symptom card renders in all phases
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- Removing the Home phase guard breaks a test that asserts phase-specific
  visibility (that test encodes the old behavior — report, don't override).
- CI fails twice on the same error after a reasonable fix attempt.

## Maintenance notes

- If pregnancy-risk copy ever becomes regulated medical advice, the upfront
  badge is the string to review with a clinician — note its i18n key
  (`sexFertileWarn`) for that review.
- Reviewer: confirm the warning reads as information ("this date is in the
  fertile window"), not as a judgment on the user's choice.
