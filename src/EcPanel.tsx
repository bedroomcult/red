import { useState } from 'react';
import { useEscape } from './useEscape';
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

export default function EcPanel({ events, current, onClose, onSaved, onSyncFail }: {
  events: EcEvent[];
  current: EcEvent | null; // the event being edited, or null for a new one
  onClose: () => void;
  onSaved: (state: any) => void;
  onSyncFail: (retry: () => void) => void;
}) {
  useEscape(true, onClose);
  // The row selected for editing. Starts at the event the parent opened with.
  const [editing, setEditing] = useState<EcEvent | null>(current);
  const [ecType, setEcType] = useState(current?.ec_type ?? 'LNG');
  const [intake, setIntake] = useState(current ? toDateInput(current.intake_at) : localDate());
  const [upsi, setUpsi] = useState(toDateInput(current?.upsi_at));

  function loadInto(ev: EcEvent) {
    setEditing(ev);
    setEcType(ev.ec_type);
    setIntake(toDateInput(ev.intake_at));
    setUpsi(toDateInput(ev.upsi_at));
  }

  // Snapshot the form: close() unmounts us, so run() must not read state.
  async function save() {
    const id = editing?.id;
    const body = JSON.stringify({
      id,
      ec_type: ecType,
      intake_date: intake,
      upsi_date: upsi || undefined,
    });
    const run = async () => {
      const r = await apiFetch('/api/ec', { method: 'POST', body });
      if (!r.ok) throw new Error((await readJson(r)).error ?? r.statusText);
      onSaved(await readJson(r));
    };
    onClose();
    try { await run(); } catch { onSyncFail(() => { void run().catch(() => onSyncFail(() => {})); }); }
  }

  async function del() {
    if (!editing) return;
    const id = editing.id;
    const run = async () => {
      const r = await apiFetch('/api/ec?id=' + encodeURIComponent(id), { method: 'DELETE' });
      if (!r.ok) throw new Error((await readJson(r)).error ?? r.statusText);
      onSaved(await readJson(r));
    };
    onClose();
    try { await run(); } catch { onSyncFail(() => { void run().catch(() => onSyncFail(() => {})); }); }
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t.ecTitle}>
        <div className="sheet-body">
          <div className="grabber" />
          <h3>{editing ? t.ecEdit : t.ecTitle}</h3>
          <div className="hint">{t.ecHint}</div>

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
              instead of only being able to add a new dose. Each row is one tap
              target: the button fills the row, so the affordance is the row
              rather than a small date chip inside it. Selected row is marked by
              the shared grey fill, matching the app's other selected states. */}
          {events.length > 0 && (
            <div className="field">
              <label>{t.ecHistory}</label>
              <ul className="list">
                {events.map((ev) => (
                  <li key={ev.id} className="ec-row-item">
                    <button
                      type="button"
                      className={`ec-row ${ev.id === editing?.id ? 'on' : ''}`}
                      onClick={() => loadInto(ev)}
                      aria-pressed={ev.id === editing?.id}
                    >
                      <span className="ec-row-date">{toDateInput(ev.intake_at)}</span>
                      <span className="meta">
                        {LABELS[ev.ec_type] ?? ev.ec_type}
                        {ev.upsi_at ? ` · ${t.ecUpsi}: ${toDateInput(ev.upsi_at)}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="sheet-actions">
          <button className="btn primary" onClick={save}>{t.ecSave}</button>
          <div className="btn-grid">
            {editing && <button className="btn danger" onClick={del}>{t.remove}</button>}
            <button className="btn ghost" onClick={onClose}>{t.ecClose}</button>
          </div>
        </div>
      </div>
    </>
  );
}
