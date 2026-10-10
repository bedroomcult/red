import { useState } from 'react';
import { useEscape } from './useEscape';
import { t } from './i18n';
import { localDate } from '../lib/today';
import { apiFetch, readJson } from './api';

const REGIMENS = ['21/7', '24/4', 'continuous'] as const;

export default function BcPanel({ current, onClose, onSaved, onSyncFail }: {
  current: { pill_type: string; regimen: string } | null;
  onClose: () => void; onSaved: (state: any) => void;
  onSyncFail: (retry: () => void) => void;
}) {
  useEscape(true, onClose);
  const [pillType, setPillType] = useState(current?.pill_type ?? 'combined');
  const [regimen, setRegimen] = useState(current?.regimen ?? '21/7');
  const [taken, setTaken] = useState(true);
  // Stopping contraception deletes the regimen and re-enables cycle predictions.
  // It sits in the same visual slot as clearing a day's log, so it asks first.
  const [confirmStop, setConfirmStop] = useState(false);

  async function save() {
    const body = JSON.stringify({
      pill_type: pillType, regimen,
      pack_start_date: localDate(),
      taken,
    });
    const run = async () => {
      const r = await apiFetch('/api/bc', { method: 'POST', body });
      if (!r.ok) throw new Error((await readJson(r)).error ?? r.statusText);
      onSaved(await readJson(r));
    };
    onClose();
    try { await run(); } catch { onSyncFail(() => { void run().catch(() => onSyncFail(() => {})); }); }
  }

  async function stop() {
    const run = async () => {
      const r = await apiFetch('/api/bc', { method: 'DELETE' });
      if (!r.ok) throw new Error((await readJson(r)).error ?? r.statusText);
      onSaved(await readJson(r));
    };
    onClose();
    try { await run(); } catch { onSyncFail(() => { void run().catch(() => onSyncFail(() => {})); }); }
  }

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t.bcTitle}>
        <div className="sheet-body">
        <div className="grabber" />
        <h3>{t.bcTitle}</h3>
        <div className="hint">{t.bcHint}</div>
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
        </div>

        <div className="sheet-actions">
          {confirmStop ? (
            <>
              <div className="hint" style={{ margin: 0 }}>{t.bcStopConfirm}</div>
              <button className="btn danger" onClick={stop}>{t.bcStopYes}</button>
              <button className="btn ghost" onClick={() => setConfirmStop(false)}>{t.bcCancel}</button>
            </>
          ) : (
            <>
              <button className="btn primary" onClick={save}>{t.bcSave}</button>
              <div className="btn-grid">
                {current && <button className="btn danger" onClick={() => setConfirmStop(true)}>{t.bcStop}</button>}
                <button className="btn ghost" onClick={onClose}>{t.bcClose}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
