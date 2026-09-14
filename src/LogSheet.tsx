import { useState } from 'react';
import type { Period } from './Calendar';
import { t } from './i18n';

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

  // id present => UPDATE existing (lets user set period end), else INSERT.
  const save = (type: string) => post({
    id: existing?.id,
    start_date: date,
    type,
    flow,
    end_date: endDate || undefined,
  });

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={date}>
        <div className="grabber" />
        <h3>{date}</h3>
        <div className="hint">
          {existing ? `${t.logged}: ${existing.type === 'menstruation' ? t.legendPeriod : t.legendSpotting}` : t.noLog}
        </div>
        {err && <div className="err">{err}</div>}
        <div className="field">
          <label>{t.flow}</label>
          <select value={flow} onChange={(e) => setFlow(e.target.value)}>
            <option value="light">{t.flowLight}</option>
            <option value="medium">{t.flowMedium}</option>
            <option value="heavy">{t.flowHeavy}</option>
          </select>
        </div>
        <div className="field">
          <label>{t.end}</label>
          <input type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="row">
          <button className="btn primary" disabled={busy} onClick={() => save('menstruation')}>{t.logPeriod}</button>
          <button className="btn" disabled={busy} onClick={() => save('spotting')}>{t.spotting}</button>
          {existing && <button className="btn danger" disabled={busy} onClick={del}>{t.remove}</button>}
          <button className="btn ghost" disabled={busy} onClick={onClose}>{t.skip}</button>
        </div>
      </div>
    </>
  );
}
