import { useEffect, useState } from 'react';
import { t } from './i18n';
import { checkForUpdate, RELEASES_PAGE, type UpdateInfo } from './update';
import { isNative } from './native';

// Banner shown when a newer release exists. On Android it opens the APK download
// so the update is one tap; on the web it opens the releases page.
export default function UpdateBanner() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const current = __APP_VERSION__;

  useEffect(() => {
    let on = true;
    checkForUpdate(current).then((r) => { if (on) setInfo(r); });
    return () => { on = false; };
  }, [current]);

  if (!info || dismissed) return null;

  function open() {
    // ponytail: window.open, not the Browser plugin — one less native dependency
    // for a link the WebView already handles.
    window.open(info!.url || RELEASES_PAGE, '_blank', 'noopener');
  }

  return (
    <div className="banner update" role="status">
      <div className="update-text">
        <strong>{t.updateAvailable}</strong>
        <span className="update-sub">
          {t.updateFrom.replace('{a}', current).replace('{b}', info.latest)}
          {isNative() ? ` (${t.updateTapInstall})` : ''}
        </span>
      </div>
      <div className="row tight">
        <button className="btn primary" onClick={open}>{t.updateNow}</button>
        <button className="btn ghost" onClick={() => setDismissed(true)}>{t.updateLater}</button>
      </div>
    </div>
  );
}
