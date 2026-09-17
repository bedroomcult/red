import { useState } from 'react';
import { t } from './i18n';
import { localDate } from '../lib/today';
import { apiFetch, readJson } from './api';

export type EcEvent = { id: string; ec_type: string; intake_at: string; upsi_at: string | null };

// intake_at/upsi_at are stored as midday UTC timestamps; the inputs are dates.
const toDateInput = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '');

const LABELS: Record<string, string> = {
  LNG: 'LNG (≤72 jam)',
  UPA: 'UPA (≤120 jam)',
  copper: 'IUD tembaga (≤5 hari)',
  'copper-IUD': 'IUD tembaga (≤5 hari)',
};

export default function EcPanel({ events, current, onClose, onSaved }: {
  events: EcEvent[];
  current: EcEvent | null; // the event being edited, or null for a new one
  onClose: () => void;
  onSaved: (state: any) => void;
}) {
  // The row selected for editing. Starts at the event the parent opened with.
  const [editing, setEditing] = useState<EcEvent | null>(current);
  const [ecType, setEcType] = useState(current?.ec_type ?? 'LNG');
  const [intake, setIntake] = useState(current ? toDateInput(current.intake_at) : localDate());
  const [upsi, setUpsi] = useState(toDateInput(current?.upsi_at));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function loadInto(ev: EcEvent) {
    setEditing(ev);
    setEcType(ev.ec_type);
    setIntake(toDateInput(ev.intake_at));
    setUpsi(toDateInput(ev.upsi_at));
    setErr(null);
  }

  async function save() {
    setBusy(true); setErr(null);
    try {
      const r = await apiFetch('/api/ec', {
        method: 'POST',
        body: JSON.stringify({
          id: editing?.id,
          ec_type: ecType,
          intake_date: intake,
          upsi_date: upsi || undefined,
        }),
      });
      if (!r.ok) throw new Error((await readJson(r)).error ?? r.statusText);
      onSaved(await readJson(r));
      onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function del() {
    if (!editing) return;
    setBusy(true); setErr(null);
    try {
      const r = await apiFetch('/api/ec?id=' + encodeURIComponent(editing.id), { method: 'DELETE' });
      if (!r.ok) throw new Error((await readJson(r)).error ?? r.statusText);
      onSaved(await readJson(r));
      onClose();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t.ecTitle}>
        <div className="sheet-body">
          <div className="grabber" />
          <h3>{editing ? t.ecEdit : t.ecTitle}</h3>
          <div className="hint">{t.ecHint}</div>
          {err && <div className="err">{err}</div>}

          <div className="field">
            <label htmlFor="ec-type">{t.bcType}</label>
            <select id="ec-type" value={ecType} onChange={(e) => setEcType(e.target.value)}>
              <option value="LNG">{LABELS.LNG}</option>
              <option value="UPA">{LABELS.UPA}</option>
              <option value="copper">{LABELS.copper}</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="ec-intake">{t.ecTaken}</label>
            <input id="ec-intake" type="date" value={intake} onChange={(e) => setIntake(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="ec-upsi">{t.ecUpsi}</label>
            <input id="ec-upsi" type="date" value={upsi} onChange={(e) => setUpsi(e.target.value)} />
          </div>

          {/* Existing events, so the user can see and correct the history
              instead of only being able to add a new dose. */}
          {events.length > 0 && (
            <div className="field">
              <label>{t.ecHistory}</label>
              <ul className="list">
                {events.map((ev) => (
                  <li key={ev.id} className={ev.id === editing?.id ? 'ec-row active' : 'ec-row'}>
                    <button className="btn" style={{ padding: '6px 12px' }} onClick={() => loadInto(ev)} disabled={busy}>
                      {toDateInput(ev.intake_at)}
                    </button>
                    <span className="meta">
                      {LABELS[ev.ec_type] ?? ev.ec_type}
                      {ev.upsi_at ? ` · ${t.ecUpsi}: ${toDateInput(ev.upsi_at)}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="sheet-actions">
          <button className="btn primary" disabled={busy} onClick={save}>{t.ecSave}</button>
          <div className="btn-grid">
            {editing && <button className="btn danger" disabled={busy} onClick={del}>{t.remove}</button>}
            <button className="btn ghost" disabled={busy} onClick={onClose}>{t.ecClose}</button>
          </div>
        </div>
      </div>
    </>
  );
}
