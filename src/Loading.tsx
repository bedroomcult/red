import { t } from './i18n';

// First-load screen. Replaces the bare spinner with the app mark and a pulse, so
// the first paint shows something recognisably "Red" rather than a blank page.
export default function Loading() {
  return (
    <div className="app loading-screen" role="status" aria-live="polite" aria-label={t.loading}>
      <div className="loading-mark">
        <svg viewBox="0 0 48 48" width="56" height="56" fill="none" aria-hidden="true">
          <path d="M24 6c5.5 7 12 14.4 12 21a12 12 0 0 1-24 0c0-6.6 6.5-14 12-21Z" fill="currentColor" />
        </svg>
        <span className="loading-ring" aria-hidden="true" />
      </div>
      <div className="loading-name">{t.appName}</div>
      <div className="loading-dots" aria-hidden="true">
        <i /><i /><i />
      </div>
    </div>
  );
}
