# Plan 007: Confirm period cancel and fix its misleading label

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f8c4062..HEAD -- src/DaySheet.tsx src/i18n.ts`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (UX-data-loss)
- **Planned at**: commit `f8c4062`, 2026-09-24

## Why this matters

The period card's cancel path is a one-tap DELETE with no confirmation, and
its button reuses the `Batal` (Cancel) label — the same word the app uses for
"close this dialog" everywhere else. Since the modal change, a successful
delete also auto-closes the modal, so the row vanishes with no visible trace
and no undo. A mis-tap on a button that reads "cancel" must not be the way a
user loses a logged period.

## Current state

- `src/DaySheet.tsx` — `quickPeriod()` (~line 230): when
  `startLog?.type === 'menstruation'`, it sends
  `DELETE /api/periods?id=...`, calls `onDoseSaved`, then `close()` (modal
  auto-close). No confirmation step.
- `src/DaySheet.tsx` — period modal (~line 458): the cancel button reads
  `{t.exitNo}`:
    ```tsx
    {startLog?.type === 'menstruation' && (
      <button className="btn" disabled={periodBusy} onClick={quickPeriod}>
        {t.exitNo}
      </button>
    )}
    ```
- `src/i18n.ts` — `exitNo: 'Batal'`, also used for the Android exit-confirm
  dialog and LogSheet skip buttons: the word means "dismiss", not "delete".
- Backend `functions/api/periods.ts` `onRequestDelete` is correct and scoped
  (`WHERE id=? AND user_id=?`); no server change needed.
- Repo conventions: `BcPanel.tsx` already does this right — a two-step stop
  flow with `confirmStop` state, `bcStop` → `bcStopYes` / `bcCancel` keys in
  `src/i18n.ts`. Match that pattern.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Watch CI | `gh run list --branch <branch> --limit 2` | `completed success` on the `ci` workflow |

## Scope

**In scope** (the only files you should modify):
- `src/DaySheet.tsx` (two-step confirm + relabel)
- `src/i18n.ts` (new keys only, e.g. `dayPeriodCancel`, `dayPeriodCancelYes`, `dayPeriodCancelBack`)
- `test/ovulation.test.ts` (regression assertions in the existing source-reading style)

**Out of scope** (do NOT touch):
- `functions/api/periods.ts` — server delete is correct.
- `src/LogSheet.tsx`, `src/BcPanel.tsx` — reference only.
- Any change to the quick-log POST path or the `inRange → onLog` path.

## Git workflow

- Branch: `advisor/007-period-cancel-confirm`
- Commit message style: short imperative, e.g. `daysheet: confirm period cancel` (see `git log --oneline -5`).
- Do NOT push except to let CI verify, and only if the operator explicitly asks.

## Steps

### Step 1: Two-step cancel with a destructive label

In `src/DaySheet.tsx`:

1. Add a `confirmCancel` boolean state. Reset it in two places: the existing
   `useEffect(..., [date])` that already resets `activeModal`/`periodErr`,
   AND in the shared `close()` function (it only calls `setActiveModal(null)`
   + `onModalOpenChange?.(false)` today — add `setConfirmCancel(false)` there
   so X/overlay/Escape on the period modal also clears a pending confirm).
2. In the period modal, replace the `{t.exitNo}` button: first tap sets
   `confirmCancel` to true and swaps the modal body to an explicit question
   ("Hapus catatan haid tanggal ini?") with two buttons — a `btn danger`
   confirm that calls `quickPeriod()`, and a ghost back button that clears
   `confirmCancel`.
3. Add three i18n keys to `src/i18n.ts` next to the other `day*` keys
   (Indonesian, matching existing tone): `dayPeriodCancel:
   'Hapus catatan ini'` (first-tap button label), `dayPeriodCancelAsk:
   'Hapus catatan haid tanggal ini? Tindakan ini tidak bisa dibatalkan.'`
   (confirm-screen question), `dayPeriodCancelBack: 'Kembali'` (abort
   button). Do NOT reuse `exitNo` for the destructive action — the abort
   button uses `dayPeriodCancelBack`, not `exitNo`, so a later grep for
   `t.exitNo` in DaySheet finds only non-destructive dismissals.

**Verify**: `git diff --stat` shows only `src/DaySheet.tsx` and `src/i18n.ts`;
re-read the modal block and confirm the DELETE path is reachable only after
the confirm step.

### Step 2: Regression tests

In `test/ovulation.test.ts`, add assertions in the existing source-reading
style: the period modal contains a confirm-gated delete (e.g.
`expect(day).toMatch(/confirmCancel/)`), and the destructive button does not
use `{t.exitNo}` for the delete action.

**Verify**: test file parses (CI runs it).

### Step 3: CI verification

Push the branch (only with operator approval) and run
`gh run list --branch advisor/007-period-cancel-confirm --limit 2` until the
`ci` run is `completed success`.

## Test plan

- New source-reading assertions in `test/ovulation.test.ts` for the
  confirm gate and the label change.
- Manual (reviewer): open a logged period date → period card → tap delete →
  confirm screen appears (row still present) → confirm → row deleted and modal
  closes; back/close on the confirm screen aborts with no delete.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] CI `ci` workflow on the branch is `completed success`
- [ ] `grep -n "t.exitNo" src/DaySheet.tsx` shows no delete/confirm-delete action using the Cancel label (remaining `exitNo` uses, if any, are plain dismissals)
- [ ] New i18n keys exist in `src/i18n.ts`; no existing key values changed
- [ ] New test assertions exist in `test/ovulation.test.ts`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- The confirm UI cannot be built inside `DayModal` without changing that file
  (it is out of scope — but it takes `children`, so this should not happen).
- CI fails twice on the same error after a reasonable fix attempt.

## Maintenance notes

- If an app-wide undo/toast system is added later, this confirm can stay —
  confirm-then-delete plus undo is the standard pairing, not either/or.
- Reviewer: the confirm copy must read as a question about deleting, never as
  a dialog-dismiss word. Check the Indonesian wording.
