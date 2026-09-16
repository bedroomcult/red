import { useState } from 'react';
import { t } from './i18n';
import { type Theme, loadTheme, saveTheme } from './theme';
import { type ReminderPrefs, loadPrefs, savePrefs, requestPermission, syncReminders, notifyNow, notificationsSupported } from './notify';
import { apiFetch, readJson } from './api';

export default function SettingsScreen({ profile, nextPeriod, onSaved, onLogout }: {
  profile: { display_name: string | null; cycle_len: number | null; period_len: number | null } | null;
  nextPeriod: string | null;
  onSaved: (s: any) => void;
  onLogout: () => void;
}) {
  const [name, setName] = useState(profile?.display_name ?? '');
  const [cycle, setCycle] = useState(profile?.cycle_len ?? 28);
  const [period, setPeriod] = useState(profile?.period_len ?? 5);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [prefs, setPrefs] = useState<ReminderPrefs>(loadPrefs);
  const [remMsg, setRemMsg] = useState<string | null>(null);
  const [nativeOnly, setNativeOnly] = useState(false);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const r = await apiFetch('/api/profile', {
        method: 'POST',         body: JSON.stringify({ display_name: name, cycle_len: Number(cycle), period_len: Number(period) }),
      });
      if (!r.ok) throw new Error((await readJson(r)).error ?? r.statusText);
      onSaved(await readJson(r));
      setMsg(t.setSaved);
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }

  function pickTheme(v: Theme) {
    setTheme(v);
    saveTheme(v);
  }

  async function applyReminders(next: ReminderPrefs) {
    setPrefs(next);
    savePrefs(next);
    setRemMsg(null);
    if (!next.pillEnabled && !next.periodEnabled) { await syncReminders(next, null); return; }
    const ok = await requestPermission();
    if (!ok) { setRemMsg(t.remDenied); return; }
    const supported = await notificationsSupported();
    if (!supported) setNativeOnly(true);
    await syncReminders(next, nextPeriod);
    setRemMsg(t.remSaved);
  }

  async function testNotify() {
    const ok = await requestPermission();
    if (!ok) { setRemMsg(t.remDenied); return; }
    await notifyNow('Red', 'Notifikasi berfungsi ✓');
  }

  return (
    <>
      <div className="card">
        <h2>{t.setTitle}</h2>
        <div className="field">
          <label htmlFor="set-name">{t.setName}</label>
          <input id="set-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={t.setName} />
        </div>
        <div className="field">
          <label htmlFor="set-cycle">{t.setCycle}</label>
          <input id="set-cycle" type="number" min={15} max={60} value={cycle} onChange={(e) => setCycle(Number(e.target.value))} />
        </div>
        <div className="field">
          <label htmlFor="set-period">{t.setPeriod}</label>
          <input id="set-period" type="number" min={1} max={15} value={period} onChange={(e) => setPeriod(Number(e.target.value))} />
        </div>
        {msg && <div className="muted">{msg}</div>}
        <div className="row">
          <button className="btn primary" disabled={busy} onClick={save}>{t.setSave}</button>
        </div>
      </div>

      <div className="card">
        <h2>{t.setAppearance}</h2>
        <div className="row" style={{ marginTop: 0 }}>
          {([['light', t.themeLight], ['dark', t.themeDark], ['system', t.themeSystem]] as const).map(([v, label]) => (
            <button key={v} className={`btn ${theme === v ? 'primary' : ''}`} aria-pressed={theme === v} onClick={() => pickTheme(v)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>{t.setReminders}</h2>
        <label className="check">
          <input type="checkbox" checked={prefs.pillEnabled}
            onChange={(e) => applyReminders({ ...prefs, pillEnabled: e.target.checked })} />
          {t.remPill}
        </label>
        {prefs.pillEnabled && (
          <div className="field" style={{ marginTop: 10 }}>
            <label htmlFor="set-pilltime">{t.remPillTime}</label>
            <input id="set-pilltime" type="time" value={prefs.pillTime}
              onChange={(e) => applyReminders({ ...prefs, pillTime: e.target.value })} />
          </div>
        )}
        <label className="check">
          <input type="checkbox" checked={prefs.periodEnabled}
            onChange={(e) => applyReminders({ ...prefs, periodEnabled: e.target.checked })} />
          {t.remPeriod}
        </label>
        {nativeOnly && <div className="muted" style={{ marginTop: 8 }}>{t.remNativeOnly}</div>}
        {remMsg && <div className="muted" style={{ marginTop: 8 }}>{remMsg}</div>}
        <div className="row">
          <button className="btn" onClick={testNotify}>{t.remEnable}</button>
        </div>
      </div>

      <div className="card">
        <h2>{t.setAccount}</h2>
        <div className="row" style={{ marginTop: 0 }}>
          <button className="btn danger" onClick={onLogout}>{t.setLogout}</button>
        </div>
      </div>
    </>
  );
}
