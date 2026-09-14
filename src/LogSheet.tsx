import { useState } from 'react';
import type { Period } from './Calendar';

export default function LogSheet({ date, existing, onClose, onSaved }: {
  date: string; existing: Period | undefined; onClose: () => void; onSaved: (state: any) => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flow, setFlow] = useState(existing?.flow ?? 'medium');
  const [endDate, setEndDate] = useState(existing?.end_date ?? '');

  async function post(body: any) {
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/periods', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? r.statusText);
      onSaved(await r.json());
      onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function del() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch('/api/periods?id=' + existing!.id, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json()).error ?? r.statusText);
      onSaved(await r.json());
      onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={'Log ' + date}>
        <strong>{date}</strong>
        {existing && <div className="muted">logged: {existing.type}{existing.flow ? ' · ' + existing.flow : ''}</div>}
        {!existing && <div className="muted">no log = prediction stays hollow</div>}
        {err && <div className="err">{err}</div>}
        <div className="row" style={{ alignItems: 'center' }}>
          <label className="muted">Flow</label>
          <select value={flow} onChange={(e) => setFlow(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #ddd' }}>
            <option value="light">light</option>
            <option value="medium">medium</option>
            <option value="heavy">heavy</option>
          </select>
          <label className="muted">End</label>
          <input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #ddd' }} />
        </div>
        <div className="row">
          <button className="primary" disabled={busy} onClick={() => post({ start_date: date, type: 'menstruation', flow, end_date: endDate || undefined })}>Log period</button>
          <button disabled={busy} onClick={() => post({ start_date: date, type: 'spotting', flow, end_date: endDate || undefined })}>Spotting</button>
          {existing && <button disabled={busy} onClick={del}>Remove</button>}
          <button disabled={busy} onClick={onClose}>Skip</button>
        </div>
      </div>
    </>
  );
}
