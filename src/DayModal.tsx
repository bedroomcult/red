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
