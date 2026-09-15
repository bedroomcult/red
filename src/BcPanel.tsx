import { useState } from 'react';
import { t } from './i18n';
import { localDate, dateHeaders } from '../lib/today';

const REGIMENS = ['21/7', '24/4', 'continuous'] as const;

export default function BcPanel({ current, onClose, onSaved }: {
  current: { pill_type: string; regimen: string } | null;
  onClose: () => void; onSaved: (state: any) => void;
}) {
  const [pillType, setPillType] = useState(current?.pill_type ?? 'combined');
  const [regimen, setRegimen] = useState(current?.regimen ?? '21/7');
  const [taken, setTaken] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/bc', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...dateHeaders() },
        body: JSON.stringify({
          pill_type: pillType, regimen,
          pack_start_date: localDate(),
          taken,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? r.statusText);
      onSaved(await r.json());
      onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function stop() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/bc', { method: 'DELETE', headers: dateHeaders() });
      if (!r.ok) throw new Error((await r.json()).error ?? r.statusText);
      onSaved(await r.json());
      onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={t.bcTitle}>
        <div className="grabber" />
        <h3>{t.bcTitle}</h3>
        <div className="hint">{t.bcHint}</div>
        {err && <div className="err">{err}</div>}
        <div className="field">
          <label>{t.bcType}</label>
          <select value={pillType} onChange={(e) => setPillType(e.target.value)}>
            <option value="combined">{t.bcCombined}</option>
            <option value="mini">{t.bcMini}</option>
          </select>
        </div>
        <div className="field">
          <label>{t.bcRegimen}</label>
          <select value={regimen} onChange={(e) => setRegimen(e.target.value)}>
            {REGIMENS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <label className="check">
          <input type="checkbox" checked={taken} onChange={(e) => setTaken(e.target.checked)} />
          {t.bcTakenToday}
        </label>
        <div className="row">
          <button className="btn primary" disabled={busy} onClick={save}>{t.bcSave}</button>
          {current && <button className="btn danger" disabled={busy} onClick={stop}>{t.bcStop}</button>}
          <button className="btn ghost" disabled={busy} onClick={onClose}>{t.bcClose}</button>
        </div>
      </div>
    </>
  );
}
