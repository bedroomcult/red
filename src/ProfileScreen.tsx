import Icon from './Icon';
import { t } from './i18n';

// Profil: an identity banner, then the cycle figures as an editorial stat row,
// then one entry into Pengaturan. This screen never edits anything; settings
// owns the editing surface.
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
          <span className="eyebrow">{t.profTitle}</span>
          <strong className="prof-name">{name?.trim() || t.obNameTitle}</strong>
        </div>
      </div>

      <div className="section">
        <span className="eyebrow">{t.profStats}</span>
        <div className="stat-col">
          <div className="stat-block">
            <span className="stat-figure">{logged}</span>
            <span className="stat-label">{t.profLogged}</span>
          </div>
          <div className="stat-block">
            <span className="stat-figure">{avgCycle ?? '–'}</span>
            <span className="stat-label">{t.profAvgCycle}</span>
          </div>
          <div className="stat-block">
            <span className="stat-figure">{avgPeriod ?? '–'}</span>
            <span className="stat-label">{t.profAvgPeriod}</span>
          </div>
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
