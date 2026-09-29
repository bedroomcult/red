import Icon from './Icon';
import { t } from './i18n';

// Profile tab: identity header, cycle stats from existing state, and one
// button into settings at the bottom. Settings content itself stays in
// SettingsScreen; this screen never edits anything.
export default function ProfileScreen({ name, avgCycle, avgPeriod, logged, onOpenSettings, onLogout }: {
  name: string | null;
  avgCycle: number | null;
  avgPeriod: number | null;
  logged: number;
  onOpenSettings: () => void;
  onLogout: () => void;
}) {
  const initial = (name?.trim()?.[0] ?? '•').toUpperCase();
  return (
    <>
      <div className="card prof-head">
        <span className="prof-avatar" aria-hidden="true">{initial}</span>
        <div className="prof-id">
          <strong className="prof-name">{name?.trim() || t.obNameTitle}</strong>
        </div>
      </div>

      <div className="card">
        <h2>{t.profStats}</h2>
        <div className="prof-stats">
          <div className="prof-stat">
            <span className="prof-num">{logged}</span>
            <span className="muted">{t.profLogged}</span>
          </div>
          <div className="prof-stat">
            <span className="prof-num">{avgCycle ?? '–'}</span>
            <span className="muted">{t.profAvgCycle}</span>
          </div>
          <div className="prof-stat">
            <span className="prof-num">{avgPeriod ?? '–'}</span>
            <span className="muted">{t.profAvgPeriod}</span>
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
