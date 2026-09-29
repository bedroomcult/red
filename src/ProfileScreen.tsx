import Icon from './Icon';
import { t } from './i18n';

// Profil: identity banner, the cycle figures as a card of stat rows, then one
// entry into Pengaturan. This screen never edits anything; settings owns the
// editing surface.
export default function ProfileScreen({ name, avgCycle, avgPeriod, logged, onOpenSettings, onLogout }: {
  name: string | null;
  avgCycle: number | null;
  avgPeriod: number | null;
  logged: number;
  onOpenSettings: () => void;
  onLogout: () => void;
}) {
  const initial = (name?.trim()?.[0] ?? '·').toUpperCase();
  return (
    <>
      <div className="card prof-head">
        <span className="prof-avatar" aria-hidden="true">{initial}</span>
        <div className="prof-id">
          <strong className="prof-name">{name?.trim() || t.obNameTitle}</strong>
          <span className="muted">{t.profTitle}</span>
        </div>
      </div>

      <div className="card">
        <h2>{t.profStats}</h2>
        <div className="stat-row">
          <span className="stat-row-label">{t.profLogged}</span>
          <span className="stat-row-value">{logged}</span>
        </div>
        <div className="stat-row">
          <span className="stat-row-label">{t.profAvgCycle}</span>
          <span className="stat-row-value">{avgCycle ?? '–'}</span>
        </div>
        <div className="stat-row">
          <span className="stat-row-label">{t.profAvgPeriod}</span>
          <span className="stat-row-value">{avgPeriod ?? '–'}</span>
        </div>
      </div>

      <div className="row">
        <button className="btn primary" onClick={onOpenSettings}>
          <Icon name="settings" size={16} />{t.profOpenSettings}
        </button>
        <button className="btn" onClick={onLogout}>{t.profLogout}</button>
      </div>
    </>
  );
}
