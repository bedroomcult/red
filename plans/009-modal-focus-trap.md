# Plan 009: Trap focus inside DayModal

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat f8c4062..HEAD -- src/DayModal.tsx src/useEscape.ts`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch,
> treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (a11y)
- **Planned at**: commit `f8c4062`, 2026-09-24

## Why this matters

`DayModal` claims `aria-modal="true"` but Tab leaves the dialog and walks
into the DaySheet behind it — a keyboard user can activate cards and buttons
they cannot see, behind a dimmed overlay. The codebase already acknowledges
the gap: `src/useEscape.ts` carries a `ponytail:` comment saying focus
containment was deferred. Every card modal (symptoms, note, dose, sex,
period, explanation) inherits the fix at once because they all render through
`DayModal`.

## Current state

- `src/DayModal.tsx` (full file, 32 lines):
    ```tsx
    import { useEffect, useRef, type ReactNode } from 'react';
    import { useEscape } from './useEscape';
    import Icon, { type IconName } from './Icon';
    import { t } from './i18n';

    export default function DayModal({ title, icon, onClose, escapeActive = true, children }: {
      title: string;
      icon: IconName;
      onClose: () => void;
      escapeActive?: boolean;
      children: ReactNode;
    }) {
      useEscape(escapeActive, onClose);
      const ref = useRef<HTMLDivElement>(null);
      useEffect(() => { ref.current?.focus(); }, []);
      return (
        <>
          <div className="modal-overlay" onClick={onClose} />
          <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
            <div className="modal-head">
              <span className="modal-title"><Icon name={icon} size={16} />{title}</span>
              <button type="button" className="modal-x" onClick={onClose} aria-label={t.bcClose}>×</button>
            </div>
            <div className="modal-body">{children}</div>
          </div>
        </>
      );
    }
    ```
- `src/useEscape.ts` — Escape-to-close hook; not where the trap belongs.
  Do not modify it.
- No focus-trap helper exists in the repo. React 18, no new dependencies
  (the repo adds none lightly — see the ponytail ladder in the pinephone
  session notes; a ~20-line effect is the right size).
- `test/` has source-reading regression tests (`class-coverage`,
  `design-tokens`, `ovulation`) but no DOM tests — vitest runs in node without
  jsdom (verify: check `vite.config.ts` for an `environment` field; at plan
  time there is none, so a DOM test would need environment setup — out of
  scope). Test via source-reading assertion only.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Watch CI | `gh run list --branch <branch> --limit 2` | `completed success` on the `ci` workflow |

## Scope

**In scope** (the only files you should modify):
- `src/DayModal.tsx` (add the trap; optionally extract `src/useFocusTrap.ts` if the effect exceeds ~25 lines — either shape is acceptable)
- `test/ovulation.test.ts` (source-reading assertion that the trap exists)

**Out of scope** (do NOT touch):
- `src/useEscape.ts` — Escape handling is correct and layered already.
- `src/DaySheet.tsx`, `src/LogSheet.tsx`, `src/App.tsx` — all modals inherit via DayModal.
- New dependencies, `vite.config.ts` test-environment changes, i18n, CSS.

## Git workflow

- Branch: `advisor/009-modal-focus-trap`
- Commit message style: short imperative, e.g. `daymodal: trap tab focus inside dialog` (see `git log --oneline -5`).
- Do NOT push except to let CI verify, and only if the operator explicitly asks.

## Steps

### Step 1: Add the Tab trap to DayModal

Add a `keydown` effect on the dialog element (alongside the existing focus
effect) implementing the standard trap:

1. On `Tab`, collect focusable descendants of the dialog:
   `button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])`,
   filtered to visible/enabled (`!el.disabled` and `offsetParent !== null` —
   note the dialog itself has `tabIndex={-1}` for initial focus; exclude it
   from the cycle list or handle the empty/single-element case).
2. If focus is on the last element (or outside, e.g. after overlay click),
   wrap to the first; if Shift+Tab on the first, wrap to the last.
3. Handle the zero-focusable-elements case: keep focus on the dialog itself
   (it is already `tabIndex={-1}` + autofocused).
4. Keep the existing autofocus effect and `useEscape` untouched. Do NOT add
   `e.stopPropagation()` beyond what the trap needs — the Escape layering
   with LogSheet depends on the current propagation behavior.

**Verify**: re-read `src/DayModal.tsx`; confirm the effect cleans up its
listener on unmount and does nothing when the dialog ref is null.

### Step 2: Regression test + CI

Add a source-reading assertion to `test/ovulation.test.ts` (existing style):
read `src/DayModal.tsx` and assert it handles `Tab` (e.g.
`expect(modal).toMatch(/Tab/)` plus a focusable-selector or wrap assertion —
match the file's `expect(x).toMatch(...)` idiom). Then push the branch (only
with operator approval) and run
`gh run list --branch advisor/009-modal-focus-trap --limit 2` until
`completed success`.

## Test plan

- Source-reading assertion in `test/ovulation.test.ts` for the trap.
- Manual (reviewer, keyboard): open each of the 6 card modals, Tab past the
  last control — focus wraps to the first; Shift+Tab on the first wraps to
  the last; Escape still closes only the top layer; focus never lands on the
  dimmed DaySheet behind.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] CI `ci` workflow on the branch is `completed success`
- [ ] `grep -n "Tab" src/DayModal.tsx` shows the trap handler
- [ ] Existing autofocus + Escape behavior unchanged (`git diff` on those lines is empty)
- [ ] New test assertion exists in `test/ovulation.test.ts`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts.
- `vite.config.ts` already configures jsdom/happy-dom — if so, prefer a real
  DOM test over a source-reading one and note the deviation.
- The trap interferes with the nested-LogSheet Escape layering (test: open
  period modal → detail → Escape closes LogSheet, not the modal).
- CI fails twice on the same error after a reasonable fix attempt.

## Maintenance notes

- If a second dialog component is ever added, extract the trap into
  `src/useFocusTrap.ts` and share it — do not duplicate the selector list.
- The `ponytail:` comment in `src/useEscape.ts` mentioning the deferred focus
  work should be updated/removed when this lands (that file is otherwise out
  of scope — one comment line is acceptable; flag it in the PR if unsure).
- Reviewer: Tab-trap + autofocus + Escape-layering is the full keyboard
  contract for the modal. Screen-reader focus return on close (return focus
  to the opening card) is a known follow-up, not part of this plan.
