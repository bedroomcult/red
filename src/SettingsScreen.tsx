import { useState } from 'react';
import { t } from './i18n';

export default function SettingsScreen({ profile, onSaved, onLogout }: {
  profile: { display_name: string | null; cycle_len: number | null; period_len: number | null } | null;
  onSaved: (s: any) => void;
  onLogout: () => void;
}) {
  const [name, setName] = useState(profile?.display_name ?? '');
  const [cycle, setCycle] = useState(profile?.cycle_len ?? 28);
  const [period, setPeriod] = useState(profile?.period_len ?? 5);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: name, cycle_len: Number(cycle), period_len: Number(period) }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? r.statusText);
      onSaved(await r.json());
      setMsg(t.setSaved);
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="card">
        <h2>{t.setTitle}</h2>
        <div className="field">
          <label>{t.setName}</label>
          <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={t.setName} />
        </div>
        <div className="field">
          <label>{t.setCycle}</label>
          <input type="number" min={15} max={60} value={cycle} onChange={(e) => setCycle(Number(e.target.value))} />
        </div>
        <div className="field">
          <label>{t.setPeriod}</label>
          <input type="number" min={1} max={15} value={period} onChange={(e) => setPeriod(Number(e.target.value))} />
        </div>
        {msg && <div className="muted">{msg}</div>}
        <div className="row">
          <button className="btn primary" disabled={busy} onClick={save}>{t.setSave}</button>
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
