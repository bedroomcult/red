import { useState } from 'react';
import type { Period } from './Calendar';

export default function LogSheet({ date, existing, onClose, onSaved }: {
  date: string; existing: Period | undefined; onClose: () => void; onSaved: (state: any) => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        <div className="row">
          <button className="primary" disabled={busy} onClick={() => post({ start_date: date, type: 'menstruation' })}>Log period</button>
          <button disabled={busy} onClick={() => post({ start_date: date, type: 'spotting' })}>Spotting</button>
          {existing && <button disabled={busy} onClick={del}>Remove</button>}
          <button disabled={busy} onClick={onClose}>Skip</button>
        </div>
      </div>
    </>
  );
}
