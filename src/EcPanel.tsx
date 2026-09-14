import { useState } from 'react';

export default function EcPanel({ onClose, onSaved }: {
  onClose: () => void; onSaved: (state: any) => void;
}) {
  const [ecType, setEcType] = useState('LNG');
  const [intake, setIntake] = useState(new Date().toISOString().slice(0, 10));
  const [upsi, setUpsi] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/ec', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ec_type: ecType,
          intake_at: new Date(intake + 'T12:00:00Z').toISOString(),
          upsi_at: upsi ? new Date(upsi + 'T12:00:00Z').toISOString() : undefined,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? r.statusText);
      onSaved(await r.json());
      onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label="Emergency contraception">
        <strong>Emergency pill</strong>
        <div className="muted">Cycle disrupted ±7d LNG, ±10d UPA. Ovulation unreliable. Log next bleed to recalibrate. Test if no bleed expected+7d or 21d after UPSI/EC. Seek care if &gt;2 pads/hr 2h, severe pain, faintness, positive test, delay &gt;3wk. General info only, not medical advice — consult clinician.</div>
        {err && <div className="err">{err}</div>}
        <div className="row" style={{ alignItems: 'center' }}>
          <label className="muted">Type</label>
          <select value={ecType} onChange={(e) => setEcType(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #ddd' }}>
            <option value="LNG">LNG (≤72h)</option>
            <option value="UPA">UPA (≤120h)</option>
            <option value="copper">Copper IUD (≤5d)</option>
            <option value="copper">copper IUD (≤5d)</option>
          </select>
        </div>
        <div className="row" style={{ alignItems: 'center' }}>
          <label className="muted">Taken</label>
          <input type="date" value={intake} onChange={(e) => setIntake(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #ddd' }} />
          <label className="muted">Unprotected</label>
          <input type="date" value={upsi} onChange={(e) => setUpsi(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #ddd' }} />
        </div>
        <div className="row">
          <button className="primary" disabled={busy} onClick={save}>Log EC</button>
          <button disabled={busy} onClick={onClose}>Close</button>
        </div>
      </div>
    </>
  );
}
