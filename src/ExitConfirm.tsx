import { useEffect, useState } from 'react';
import { t } from './i18n';
import { isNative } from './native';

// Android hardware back button.
//
// Without a handler the WebView does nothing, so the button felt broken: the user
// pressed back and the app sat there. The expected behaviour is a confirm step
// before leaving, matching every other Android app.
//
// Order of precedence:
//   1. any open sheet closes (handled by the sheet's own Escape/close path)
//   2. on a tab other than home, go back to home
//   3. otherwise, ask before exiting
export default function ExitConfirm({ onRequestClose, canGoHome, onGoHome }: {
  // Returns true when a sheet consumed the back press.
  onRequestClose: () => boolean;
  canGoHome: boolean;
  onGoHome: () => void;
}) {
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!isNative()) return;
    let handle: { remove: () => void } | undefined;
    let cancelled = false;

    (async () => {
      const mod: any = await import('@capacitor/app');
      if (cancelled) return;
      handle = await mod.App.addListener('backButton', () => {
        if (onRequestClose()) return;
        if (canGoHome) { onGoHome(); return; }
        setAsking(true);
      });
    })();

    return () => { cancelled = true; handle?.remove(); };
  }, [onRequestClose, canGoHome, onGoHome]);

  if (!asking) return null;

  async function exit() {
    const mod: any = await import('@capacitor/app');
    await mod.App.exitApp();
  }

  return (
    <>
      <div className="overlay" onClick={() => setAsking(false)} />
      <div className="sheet confirm-sheet" role="dialog" aria-modal="true" aria-label={t.exitTitle}>
        <div className="sheet-body">
          <div className="grabber" />
          <h3>{t.exitTitle}</h3>
          <div className="muted">{t.exitBody}</div>
        </div>
        <div className="sheet-actions">
          <button className="btn primary" onClick={exit}>{t.exitYes}</button>
          <button className="btn ghost" onClick={() => setAsking(false)}>{t.exitNo}</button>
        </div>
      </div>
    </>
  );
}
