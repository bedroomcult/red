import { useEffect, useState } from 'react';
import { cycleStatus, periodForDate, type Phase } from '../lib/cycle';
import type { Dose, Period, Prediction } from './Calendar';
import { t } from './i18n';
import { apiFetch, readJson } from './api';

const PHASE_LABEL: Record<Phase, string> = {
  period: t.phasePeriod,
  fertile: t.phaseFertile,
  ovulation: t.phaseOvulation,
  pms: t.phasePms,
  neutral: t.phaseNeutral,
  bc: t.phaseBc,
};

const SYM_LABEL: Record<string, string> = {
  cramps: t.symCramps, bloating: t.symBloating, headache: t.symHeadache, mood: t.symMood,
  tired: t.symTired, breast: t.symBreast, acne: t.symAcne, craving: t.symCraving,
};

const fmtLong = (d: string) =>
  new Date(d + 'T00:00:00Z').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// Read-only view of one day. Tapping a calendar cell lands here; editing a period
// is an explicit second step via onLog. Showing the form first made every tap a
// commitment to logging, and buried the symptoms/note already stored for the day.
export default function DaySheet({ date, periods, prediction, bcMode, dose, onDoseSaved, onLog, onClose }: {
  date: string;
  periods: Period[];
  prediction: Prediction | null;
  bcMode: boolean;
  dose: Dose | undefined;
  onDoseSaved: (state: any) => void;
  onLog: (date: string) => void;
  onClose: () => void;
}) {
  const [syms, setSyms] = useState<string[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [doseBusy, setDoseBusy] = useState(false);
  const [doseErr, setDoseErr] = useState<string | null>(null);
  // Local echo of the parent's dose, so the buttons update before the refetch.
  const [doseLocal, setDoseLocal] = useState<boolean | null>(dose ? dose.taken : null);

  useEffect(() => { setDoseLocal(dose ? dose.taken : null); }, [date, dose]);

  useEffect(() => {
    let on = true;
    setSyms(null);
    setNote(null);
    apiFetch('/api/symptoms?date=' + date)
      .then((r) => (r.ok ? readJson(r) : { symptoms: [] }))
      .then((j) => { if (on) setSyms((j.symptoms ?? []).map((s: any) => s.kind)); })
      .catch(() => { if (on) setSyms([]); });
    apiFetch('/api/notes?date=' + date)
      .then((r) => (r.ok ? readJson(r) : { note: '' }))
      .then((j) => { if (on) setNote(j.note ?? ''); })
      .catch(() => { if (on) setNote(''); });
    return () => { on = false; };
  }, [date]);

  const starts = periods.filter((p) => p.type === 'menstruation').map((p) => p.start_date);
  const ranges = periods.filter((p) => p.type === 'menstruation').map((p) => ({ start_date: p.start_date, end_date: p.end_date }));
  const st = cycleStatus(date, starts, ranges, prediction, bcMode);

  // taken: true | false | null (null clears). Any date, past or future.
  async function setDose(taken: boolean | null) {
    setDoseBusy(true);
    setDoseErr(null);
    const prev = doseLocal;
    setDoseLocal(taken);
    try {
      const r = await apiFetch('/api/doses', { method: 'POST', body: JSON.stringify({ date, taken }) });
      if (!r.ok) throw new Error((await readJson(r)).error ?? r.statusText);
      onDoseSaved(await readJson(r));
    } catch (e: any) {
      setDoseLocal(prev);
      setDoseErr(e.message);
    } finally {
      setDoseBusy(false);
    }
  }

  const startLog = periods.find((p) => p.start_date === date);
  const inRange = periodForDate(periods, date);
  const inPredWindow = !!(prediction?.lo && prediction?.hi && date >= prediction.lo && date <= prediction.hi);
  const ov = prediction?.ov ? Date.parse(prediction.ov + 'T00:00:00Z') : null;
  const d = Date.parse(date + 'T00:00:00Z');
  // Fertile window = ovulation -5d .. +1d, matching lib/cycle.ts.
  const inFertile = ov !== null && d >= ov - 5 * 864e5 && d <= ov + 864e5;

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={fmtLong(date)}>
        <div className="sheet-body">
        <div className="grabber" />
        <h3 style={{ marginBottom: 4 }}>{fmtLong(date)}</h3>

        <div className="row tight" style={{ marginBottom: 12 }}>
          <span className={`badge ${st.phase === 'neutral' || st.phase === 'bc' ? 'grey' : st.phase === 'period' || st.phase === 'pms' ? '' : 'green'}`}>
            {PHASE_LABEL[st.phase]}
          </span>
          {st.cycleDay !== null && <span className="badge grey">{t.dayCycle.replace('{n}', String(st.cycleDay))}</span>}
        </div>

        {startLog ? (
          <div className="day-info">
            <div className="day-info-label">{t.dayPeriodLogged}</div>
            <div className="day-info-value">
              {startLog.type === 'menstruation' ? t.legendPeriod : t.legendSpotting}
              {startLog.flow ? ` · ${startLog.flow === 'light' ? t.flowLight : startLog.flow === 'heavy' ? t.flowHeavy : t.flowMedium}` : ''}
              {startLog.end_date ? ` · ${t.dayUntil} ${fmtLong(startLog.end_date).replace(/^[^,]+,\s*/, '')}` : ` · ${t.dayOngoing}`}
            </div>
          </div>
        ) : inRange ? (
          <div className="day-info">
            <div className="day-info-label">{t.dayPeriodLogged}</div>
            <div className="day-info-value">{t.dayInPeriodRange}</div>
          </div>
        ) : null}

        {!startLog && !inRange && inPredWindow && (
          <div className="day-info">
            <div className="day-info-label">{t.dayPredicted}</div>
            <div className="day-info-value">{t.dayPredictedValue}</div>
          </div>
        )}

        {!startLog && !inRange && !inPredWindow && inFertile && (
          <div className="day-info">
            <div className="day-info-label">{t.dayFertile}</div>
            <div className="day-info-value">{date === prediction!.ov ? t.dayOvulationValue : t.dayFertileValue}</div>
          </div>
        )}

        <div className="day-info">
          <div className="day-info-label">{t.daySymptoms}</div>
          <div className="day-info-value">
            {syms === null ? t.loading
              : syms.length === 0 ? <span className="muted">{t.dayNoSymptoms}</span>
              : <span className="chips">{syms.map((k) => <span key={k} className="sym-chip">{SYM_LABEL[k] ?? k}</span>)}</span>}
          </div>
        </div>

        <div className="day-info">
          <div className="day-info-label">{t.note}</div>
          <div className="day-info-value">
            {note === null ? t.loading
              : note ? <span style={{ whiteSpace: 'pre-wrap' }}>{note}</span>
              : <span className="muted">{t.dayNoNote}</span>}
          </div>
        </div>

        <div className="day-info">
          <div className="day-info-label">{t.dayDose}</div>
          <div className="day-info-value">
            {doseLocal === null ? <span className="muted">{t.doseNone}</span>
              : doseLocal ? t.doseTakenLabel : t.doseMissedLabel}
          </div>
          <div className="row tight">
            <button className={`btn ${doseLocal === true ? 'on' : ''}`} disabled={doseBusy}
              aria-pressed={doseLocal === true} onClick={() => setDose(true)}>{t.doseTaken}</button>
            <button className={`btn ${doseLocal === false ? 'on' : ''}`} disabled={doseBusy}
              aria-pressed={doseLocal === false} onClick={() => setDose(false)}>{t.doseMissed}</button>
            {doseLocal !== null && (
              <button className="btn ghost" disabled={doseBusy} onClick={() => setDose(null)}>{t.doseClear}</button>
            )}
          </div>
          {doseErr && <div className="err">{doseErr}</div>}
        </div>

        </div>

        <div className="sheet-actions">
          <button className="btn primary" onClick={() => onLog(date)}>{t.dayLogHere}</button>
          <button className="btn ghost" onClick={onClose}>{t.bcClose}</button>
        </div>
      </div>
    </>
  );
}
