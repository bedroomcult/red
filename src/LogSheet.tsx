import { useEffect, useState } from 'react';
import { useEscape } from './useEscape';
import type { Period } from './Calendar';
import { t } from './i18n';
import { apiFetch, readJson } from './api';

export default function LogSheet({ date, existing, active, onClose, onSaved, onSyncFail, raised = false }: {
  date: string; existing: Period | undefined; active: Period | undefined;
  onClose: () => void; onSaved: (state: any) => void;
  // Called with a retry thunk when a request fails AFTER the sheet closed.
  // Without it the error would have no surface at all.
  onSyncFail: (retry: () => void) => void;
  // True when opened from inside a card modal: render above the modal.
  raised?: boolean;
}) {
  useEscape(true, onClose);
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

  // Close-then-sync: the sheet closes on tap and the request runs behind
  // it. onSaved applies the server echo when it lands; a failure surfaces
  // via onSyncFail (banner + retry) instead of trapping the user in an
  // open sheet staring at a spinner.
  async function post(body: any) {
    const run = async () => {
      const r = await apiFetch('/api/periods', {
        method: 'POST',         body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await readJson(r)).error ?? r.statusText);
      onSaved(await readJson(r));
    };
    onClose();
    try { await run(); } catch { onSyncFail(() => { void run().catch(() => onSyncFail(() => {})); }); }
  }

  async function del() {
    const target = existing ?? active;
    if (!target) return;
    const run = async () => {
      const r = await apiFetch('/api/periods?id=' + target.id, { method: 'DELETE' });
      if (!r.ok) throw new Error((await readJson(r)).error ?? r.statusText);
      onSaved(await readJson(r));
    };
    onClose();
    try { await run(); } catch { onSyncFail(() => { void run().catch(() => onSyncFail(() => {})); }); }
  }

  // id present => UPDATE existing (lets user set period end), else INSERT.
  // The note is saved in the same action: it is one form, and a note typed then
  // lost because the user tapped "Catat haid" instead of "Simpan catatan" is a
  // silent data loss bug.
  async function save(type: string) {
    const payload = { id: existing?.id, start_date: date, type, flow, end_date: endDate || undefined };
    const noteText = note.trim();
    const run = async () => {
      const r = await apiFetch('/api/periods', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error((await readJson(r)).error ?? r.statusText);
      if (noteText) {
        const n = await apiFetch('/api/notes', { method: 'POST', body: JSON.stringify({ date, note: noteText }) });
        if (!n.ok) throw new Error((await readJson(n)).error ?? n.statusText);
      }
      onSaved(await readJson(r));
    };
    onClose();
    try { await run(); } catch { onSyncFail(() => { void run().catch(() => onSyncFail(() => {})); }); }
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

  const d = new Date(date + 'T00:00:00Z');
  const dayNum = Number(date.slice(8, 10));
  const monthLong = d.toLocaleDateString('id-ID', { month: 'long' });
  const weekdayLong = d.toLocaleDateString('id-ID', { weekday: 'long' });
  // Badge shows the short type label only; the full sentence stays in the
  // hint below. No-log has no short label, so it shows no badge.

  return (
    <>
      <div className={`overlay${raised ? ' sheet-overlay-raised' : ''}`} onClick={onClose} />
      <div className={`sheet${raised ? ' sheet-raised' : ''}`} role="dialog" aria-modal="true" aria-label={new Date(date + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}>
        <div className="sheet-body">
          <div className="grabber" />
          <div className="day-head">
            <div className="day-head-date">
              <span className="day-head-num">{dayNum}</span>
              <span className="day-head-mon">
                {monthLong}
                <span className="day-head-year">{date.slice(0, 4)}</span>
              </span>
            </div>
            <div className="day-head-right">
              {(inRange ? active!.type : existing?.type) === 'menstruation' ? (
                <span className={`badge ${inRange ? 'amber' : 'green'}`}>{t.legendPeriod}</span>
              ) : (inRange ? active!.type : existing?.type) === 'spotting' ? (
                <span className={`badge ${inRange ? 'amber' : 'green'}`}>{t.legendSpotting}</span>
              ) : null}
              <span className="day-head-day">{weekdayLong}</span>
            </div>
          </div>
          <div className="hint">
            {inRange
              ? t.insideRange
              : existing ? `${t.logged}: ${existing.type === 'menstruation' ? t.legendPeriod : t.legendSpotting}` : t.noLog}
          </div>
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
              <button className="btn primary" onClick={markEnd}>{t.markEndHere}</button>
              <div className="btn-grid">
                {removable && <button className="btn danger" onClick={del}>{t.remove}</button>}
                <button className="btn ghost" onClick={onClose}>{t.skip}</button>
              </div>
            </>
          ) : (
            <>
              <button className="btn primary" onClick={() => save('menstruation')}>{t.logPeriod}</button>
              <div className="btn-grid">
                <button className="btn" onClick={() => save('spotting')}>{t.spotting}</button>
                <button className="btn ghost" onClick={onClose}>{t.skip}</button>
              </div>
              {removable && <button className="btn danger" onClick={del}>{t.remove}</button>}
            </>
          )}
        </div>
      </div>
    </>
  );
}
