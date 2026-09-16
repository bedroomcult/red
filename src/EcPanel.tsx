import { useState } from 'react';
import { t } from './i18n';
import { localDate } from '../lib/today';
import { apiFetch, readJson } from './api';

export default function EcPanel({ onClose, onSaved }: {
  onClose: () => void; onSaved: (state: any) => void;
}) {
  const [ecType, setEcType] = useState('LNG');
  const [intake, setIntake] = useState(localDate());
  const [upsi, setUpsi] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setErr(null);
    try {
      const r = await apiFetch('/api/ec', {
        method: 'POST',         body: JSON.stringify({
          ec_type: ecType,
          intake_at: new Date(intake + 'T12:00:00Z').toISOString(),
          upsi_at: upsi ? new Date(upsi + 'T12:00:00Z').toISOString() : undefined,
        }),
      });
      if (!r.ok) throw new Error((await readJson(r)).error ?? r.statusText);
      onSaved(await readJson(r));
      onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={t.ecTitle}>
        <div className="grabber" />
        <h3>{t.ecTitle}</h3>
        <div className="hint">{t.ecHint}</div>
        {err && <div className="err">{err}</div>}
        <div className="field">
          <label>{t.bcType}</label>
          <select value={ecType} onChange={(e) => setEcType(e.target.value)}>
            <option value="LNG">LNG (≤72 jam)</option>
            <option value="UPA">UPA (≤120 jam)</option>
            <option value="copper">IUD tembaga (≤5 hari)</option>
          </select>
        </div>
        <div className="field">
          <label>{t.ecTaken}</label>
          <input type="date" value={intake} onChange={(e) => setIntake(e.target.value)} />
        </div>
        <div className="field">
          <label>{t.ecUpsi}</label>
          <input type="date" value={upsi} onChange={(e) => setUpsi(e.target.value)} />
        </div>
        <div className="row">
          <button className="btn primary" disabled={busy} onClick={save}>{t.ecSave}</button>
          <button className="btn ghost" disabled={busy} onClick={onClose}>{t.ecClose}</button>
        </div>
      </div>
    </>
  );
}
