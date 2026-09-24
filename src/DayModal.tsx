import { useEffect, useRef, type ReactNode } from 'react';
import { useEscape } from './useEscape';
import Icon, { type IconName } from './Icon';
import { t } from './i18n';

// Centered popup stacked over an open sheet. One instance per card; the
// content is the card's editor moved out of the grid, so DaySheet no longer
// expands in place.
export default function DayModal({ title, icon, onClose, escapeActive = true, children }: {
  title: string;
  icon: IconName;
  onClose: () => void;
  // Off while a nested sheet (period detail) sits on top, so Escape hits it.
  escapeActive?: boolean;
  children: ReactNode;
}) {
  useEscape(escapeActive, onClose);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  // Tab trap: the dialog claims aria-modal, so keyboard focus must cycle
  // inside it instead of wandering into the dimmed sheet behind. Escape is
  // left alone here — useEscape owns it and the nested-sheet layering
  // depends on that propagation behavior.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = [...el.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )].filter((n) => !(n as HTMLButtonElement).disabled && n.offsetParent !== null);
      if (!items.length) { e.preventDefault(); el.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !el.contains(active))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (active === last || !el.contains(active))) { e.preventDefault(); first.focus(); }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, []);
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
