import Icon from './Icon';
import { t } from './i18n';

// Profil (spec 4.6): header with avatar + name + status pill, then grouped list
// sections in rounded cards, then one entry into Pengaturan. This screen never
// edits anything; settings owns the editing surface.
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

      <div className="card">
        <div className="rows">
          <button onClick={onOpenSettings}>
            <Icon name="settings" size={20} />
            <span className="row-head">{t.profOpenSettings}</span>
            <span className="row-chevron" aria-hidden="true">›</span>
          </button>
          <button onClick={onLogout}>
            <Icon name="cross" size={20} />
            <span className="row-head">{t.profLogout}</span>
            <span className="row-chevron" aria-hidden="true">›</span>
          </button>
        </div>
      </div>
    </>
  );
}
