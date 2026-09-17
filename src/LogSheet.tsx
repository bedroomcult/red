import { useEffect, useState } from 'react';
import type { Period } from './Calendar';
import { t } from './i18n';
import { apiFetch, readJson } from './api';

export default function LogSheet({ date, existing, active, onClose, onSaved }: {
  date: string; existing: Period | undefined; active: Period | undefined;
  onClose: () => void; onSaved: (state: any) => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flow, setFlow] = useState(existing?.flow ?? 'medium');
  const [endDate, setEndDate] = useState(existing?.end_date ?? '');
  const [note, setNote] = useState('');

  useEffect(() => {
    let on = true;
    apiFetch('/api/notes?date=' + date)
      .then((r) => (r.ok ? readJson(r) : { note: '' }))
      .then((j) => { if (on) setNote(j.note ?? ''); })
      .catch(() => {});
    return () => { on = false; };
  }, [date]);

  async function saveNote() {
    setBusy(true); setErr(null);
    try {
      const r = await apiFetch('/api/notes', {
        method: 'POST',         body: JSON.stringify({ date, note }),
      });
      if (!r.ok) throw new Error((await readJson(r)).error ?? r.statusText);
      onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function post(body: any) {
    setBusy(true); setErr(null);
    try {
      const r = await apiFetch('/api/periods', {
        method: 'POST',         body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await readJson(r)).error ?? r.statusText);
      onSaved(await readJson(r));
      onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function del() {
    const target = existing ?? active;
    if (!target) return;
    setBusy(true); setErr(null);
    try {
      const r = await apiFetch('/api/periods?id=' + target.id, { method: 'DELETE' });
      if (!r.ok) throw new Error((await readJson(r)).error ?? r.statusText);
      onSaved(await readJson(r));
      onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  // id present => UPDATE existing (lets user set period end), else INSERT.
  // The note is saved in the same action: it is one form, and a note typed then
  // lost because the user tapped "Catat haid" instead of "Simpan catatan" is a
  // silent data loss bug.
  async function save(type: string) {
    setBusy(true); setErr(null);
    try {
      const r = await apiFetch('/api/periods', {
        method: 'POST',
        body: JSON.stringify({ id: existing?.id, start_date: date, type, flow, end_date: endDate || undefined }),
      });
      if (!r.ok) throw new Error((await readJson(r)).error ?? r.statusText);
      if (note.trim()) {
        const n = await apiFetch('/api/notes', { method: 'POST', body: JSON.stringify({ date, note }) });
        if (!n.ok) throw new Error((await readJson(n)).error ?? n.statusText);
      }
      onSaved(await readJson(r));
      onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  // Tapped a day inside a logged period range but not its start => mark end here.
  const inRange = !!active && active.start_date !== date;
  const removable = existing ?? active;
  const markEnd = () => post({
    id: active!.id,
    start_date: active!.start_date,
    type: active!.type,
    flow: active!.flow ?? flow,
    end_date: date,
  });

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={new Date(date + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}>
        <div className="sheet-body">
          <div className="grabber" />
          <h3>{date}</h3>
          <div className="hint">
            {inRange
              ? t.insideRange
              : existing ? `${t.logged}: ${existing.type === 'menstruation' ? t.legendPeriod : t.legendSpotting}` : t.noLog}
          </div>
          {err && <div className="err">{err}</div>}
          {inRange ? (
            <div className="field">
              <label>{t.end}</label>
              <div className="field-static">{date}</div>
            </div>
          ) : (
            <>
              <div className="field">
                <label htmlFor="ls-flow">{t.flow}</label>
                <select id="ls-flow" value={flow} onChange={(e) => setFlow(e.target.value)}>
                  <option value="light">{t.flowLight}</option>
                  <option value="medium">{t.flowMedium}</option>
                  <option value="heavy">{t.flowHeavy}</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="ls-end">{t.end}</label>
                <input id="ls-end" type="date" value={endDate} min={date} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="ls-note">{t.note}</label>
                <textarea id="ls-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3}
                  placeholder={t.notePlaceholder} className="textarea" />
              </div>
            </>
          )}
        </div>

        {/* Actions live in their own bar so they never wrap unpredictably or
            scroll out of reach behind a long note. */}
        <div className="sheet-actions">
          {inRange ? (
            <>
              <button className="btn primary" disabled={busy} onClick={markEnd}>{t.markEndHere}</button>
              <div className="btn-grid">
                {removable && <button className="btn danger" disabled={busy} onClick={del}>{t.remove}</button>}
                <button className="btn ghost" disabled={busy} onClick={onClose}>{t.skip}</button>
              </div>
            </>
          ) : (
            <>
              <button className="btn primary" disabled={busy} onClick={() => save('menstruation')}>{t.logPeriod}</button>
              <div className="btn-grid">
                <button className="btn" disabled={busy} onClick={() => save('spotting')}>{t.spotting}</button>
                <button className="btn" disabled={busy} onClick={saveNote}>{t.noteSave}</button>
              </div>
              <div className="btn-grid">
                {removable && <button className="btn danger" disabled={busy} onClick={del}>{t.remove}</button>}
                <button className="btn ghost" disabled={busy} onClick={onClose}>{t.skip}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
