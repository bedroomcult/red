import { useState } from 'react';

const REGIMENS = ['21/7', '24/4', '84/7', 'continuous'] as const;
const PILL_TYPES = ['combined', 'mini'] as const;

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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pill_type: pillType, regimen,
          pack_start_date: new Date().toISOString().slice(0, 10),
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
      const r = await fetch('/api/bc', { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json()).error ?? r.statusText);
      onSaved(await r.json());
      onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Birth control">
        <strong>Birth control</strong>
        <div className="muted">Suppresses ovulation predictions. Withdrawal bleed expected placebo days 2–4.</div>
        {err && <div className="err">{err}</div>}
        <div className="row" style={{ alignItems: 'center' }}>
          <label className="muted">Type</label>
          <select value={pillType} onChange={(e) => setPillType(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #ddd' }}>
            {PILL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <label className="muted">Regimen</label>
          <select value={regimen} onChange={(e) => setRegimen(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #ddd' }}>
            {REGIMENS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="row" style={{ alignItems: 'center' }}>
          <label><input type="checkbox" checked={taken} onChange={(e) => setTaken(e.target.checked)} /> took today's pill</label>
        </div>
        <div className="row">
          <button className="primary" disabled={busy} onClick={save}>Save</button>
          {current && <button disabled={busy} onClick={stop}>Stop BC</button>}
          <button disabled={busy} onClick={onClose}>Close</button>
        </div>
      </div>
    </>
  );
}
