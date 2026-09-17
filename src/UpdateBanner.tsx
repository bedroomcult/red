import { useEffect, useState } from 'react';
import { t } from './i18n';
import { checkForUpdate, RELEASES_PAGE, type UpdateInfo } from './update';
import { isNative } from './native';

// Update notice as a modal rather than a banner. A banner sat inside the
// scrolling content and was easy to scroll past; a modal is unmissable, and the
// dismiss is explicit.
export default function UpdateBanner() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const current = __APP_VERSION__;

  useEffect(() => {
    let on = true;
    checkForUpdate(current).then((r) => { if (on) setInfo(r); });
    return () => { on = false; };
  }, [current]);

  // Escape closes it, matching every other sheet in the app.
  useEffect(() => {
    if (!info || dismissed) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDismissed(true); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [info, dismissed]);

  if (!info || dismissed) return null;

  function open() {
    window.open(info!.url || RELEASES_PAGE, '_blank', 'noopener');
  }

  return (
    <>
      <div className="overlay" onClick={() => setDismissed(true)} />
      <div className="sheet update-sheet" role="dialog" aria-modal="true" aria-label={t.updateAvailable}>
        <div className="sheet-body">
          <div className="grabber" />
          <div className="update-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12M12 15l-4-4M12 15l4-4" />
              <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
          </div>
          <h3 className="update-title">{t.updateAvailable}</h3>
          <div className="update-sub">
            {t.updateFrom.replace('{a}', current).replace('{b}', info.latest)}
          </div>
          {isNative() && <div className="muted update-hint">{t.updateTapInstall}</div>}
          {info.notes && <div className="muted update-notes">{info.notes}</div>}
        </div>

        <div className="sheet-actions">
          <button className="btn primary" onClick={open}>{t.updateNow}</button>
          <button className="btn ghost" onClick={() => setDismissed(true)}>{t.updateLater}</button>
        </div>
      </div>
    </>
  );
}
