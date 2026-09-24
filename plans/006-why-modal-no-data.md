# Plan 006: Fix dead Kenapa tap when there is no prediction

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f8c4062..HEAD -- src/DaySheet.tsx`
> If DaySheet.tsx changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as a
> STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `f8c4062`, 2026-09-24

## Why this matters

Tapping the Kenapa ("why this date") card does nothing visible on any date
without a prediction (new user, 0–1 logged periods). The tap sets modal state
and reports "modal open" to App, so the next hardware back press is swallowed
closing a modal that was never visible. (BC-suppressed dates already produce a
`reason` with `kind === 'bc'`, so that path works — only `prediction === null`
is dead.) The card preview already shows the no-data text — the tap must show
the matching explanation instead of dying silently.

## Current state

- `src/DaySheet.tsx` — day bottom sheet; cards open centered modals:
  - Line ~64: `const [activeModal, setActiveModal] = useState<string | null>(null);`
  - Lines ~196–204: `reason` is `null` when `prediction` is null:
    ```tsx
    const reason = prediction
      ? explainPrediction(
          date,
          periods.filter((p) => p.type === 'menstruation').map((p) => p.start_date),
          prediction,
          { bcMode }
        )
      : null;
    ```
  - Line ~221: `const open = (k: string) => { setActiveModal(k); onModalOpenChange?.(true); };`
  - Line ~374: the verdict modal only renders when `reason` is non-null:
    ```tsx
    {activeModal === 'why' && reason && (
      <DayModal title={t.predWhy} icon="info" onClose={close} escapeActive={!logOpen}>
        <PredictionDetail date={date} reason={reason} />
      </DayModal>
    )}
    ```
- `src/PredictionDetail.tsx` — already handles the no-data case without a
  `reason` object: when `kind === 'bc'` it shows `t.predBcPaused`, when
  `kind === 'no-data'` it shows `t.predNoData` plus `t.predNeedTwo`. It takes
  `reason: PredictionReason`, so a synthetic `{ kind: 'no-data' }` object must
  still satisfy the type — check which fields it reads for that branch (at plan
  time: only `kind`; verify before using).
- `src/App.tsx` — `dayModalOpen` state (line ~37) tracks the modal for
  back-button precedence; a phantom open consumes one back press.
- Repo conventions: Indonesian UI copy via `t` in `src/i18n.ts`; no new copy
  needed here. Verification runs in CI (local toolchain unavailable on this
  machine): push the branch and watch `gh run list`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Watch CI | `gh run list --branch <branch> --limit 2` | `completed success` on the `ci` workflow (vitest + `tsc` + vite build) |

## Scope

**In scope** (the only files you should modify):
- `src/DaySheet.tsx`
- `test/ovulation.test.ts` (regression test — this suite already does source-reading assertions on DaySheet; follow its pattern)

**Out of scope** (do NOT touch):
- `src/PredictionDetail.tsx` — it already renders both empty states; do not change it.
- `src/App.tsx`, `src/DayModal.tsx` — layering is correct; the bug is the render condition.
- Any API, lib, or i18n change.

## Git workflow

- Branch: `advisor/006-why-modal-no-data`
- Commit message style: short imperative, e.g. `daysheet: kenapa modal works without prediction` (see `git log --oneline -5`).
- Do NOT push except to let CI verify, and only if the operator explicitly asks.

## Steps

### Step 1: Make the verdict modal render without a prediction

In `src/DaySheet.tsx`, change the render condition so the modal always opens,
passing a synthetic no-data reason when `reason` is null. Two acceptable
shapes — pick the one that typechecks:

(a) If `PredictionDetail`'s no-data branch only reads `reason.kind`, pass a
minimal object cast to the prop type. Prefer building the object with the real
`PredictionReason` fields set to null rather than `as any`.

(b) If the branch reads more fields, wrap: `{activeModal === 'why' && (<DayModal …>{reason ? <PredictionDetail date={date} reason={reason}/> : <div className="day-info-value">{t.predNoData}<div className="day-info-sub">{t.predNeedTwo}</div></div>}</DayModal>)}`.

BC-suppressed dates already produce a `reason` with `kind === 'bc'` (via
`explainPrediction` + `bcMode`), so only the `prediction === null` path needs
the fallback.

**Verify**: `git diff --stat` shows only `src/DaySheet.tsx`; re-read the edited
block and confirm no other `&& reason` guard remains on a modal.

### Step 2: Add a regression test

In `test/ovulation.test.ts`, extend the `renders the day as an icon card grid
with period quick-log` test (or add a sibling `it`) asserting the verdict
modal no longer requires a reason — e.g. that the `activeModal === 'why'`
render path does not include a `&& reason` guard, mirroring the existing
source-reading style (`expect(day).toMatch(...)` / `expect(day).not.toMatch(...)`).

**Verify**: test file parses (no local runner available — CI runs it).

### Step 3: CI verification

Push the branch (only with operator approval) and run
`gh run list --branch advisor/006-why-modal-no-data --limit 2` until the `ci`
run for the branch is `completed success` (vitest + tsc + vite build all run
in that workflow).

## Test plan

- New source-reading assertion in `test/ovulation.test.ts` covering the
  verdict-modal render path without a reason object.
- Manual (reviewer): open the app with a fresh account, tap any date, tap the
  Kenapa card — the explanation modal opens showing the no-data text; closing
  returns to DaySheet; hardware back with no modal closes DaySheet directly.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] CI `ci` workflow on the branch is `completed success`
- [ ] `grep -n "activeModal === 'why'" src/DaySheet.tsx` shows a render path that works when `reason` is null
- [ ] New test assertion exists in `test/ovulation.test.ts`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- `PredictionDetail`'s no-data branch requires fields you cannot construct
  without changing that file (it is out of scope).
- CI fails twice on the same error after a reasonable fix attempt.
- The fix appears to require touching an out-of-scope file.

## Maintenance notes

- If `PredictionDetail` gains a new empty-state kind, the fallback here must
  map to it.
- Reviewer: check that tapping Kenapa with no prediction, with BC suppression,
  and with a real prediction all open the modal — three states, one card.
