import { useEffect, useState } from 'react';
import { cycleStatus, periodForDate, type Phase } from '../lib/cycle';
import type { Period, Prediction } from './Calendar';
import { t } from './i18n';
import { dateHeaders } from '../lib/today';

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
export default function DaySheet({ date, periods, prediction, bcMode, onLog, onClose }: {
  date: string;
  periods: Period[];
  prediction: Prediction | null;
  bcMode: boolean;
  onLog: (date: string) => void;
  onClose: () => void;
}) {
  const [syms, setSyms] = useState<string[] | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    setSyms(null);
    setNote(null);
    fetch('/api/symptoms?date=' + date, { headers: dateHeaders() })
      .then((r) => (r.ok ? r.json() : { symptoms: [] }))
      .then((j) => { if (on) setSyms((j.symptoms ?? []).map((s: any) => s.kind)); })
      .catch(() => { if (on) setSyms([]); });
    fetch('/api/notes?date=' + date, { headers: dateHeaders() })
      .then((r) => (r.ok ? r.json() : { note: '' }))
      .then((j) => { if (on) setNote(j.note ?? ''); })
      .catch(() => { if (on) setNote(''); });
    return () => { on = false; };
  }, [date]);

  const starts = periods.filter((p) => p.type === 'menstruation').map((p) => p.start_date);
  const ranges = periods.filter((p) => p.type === 'menstruation').map((p) => ({ start_date: p.start_date, end_date: p.end_date }));
  const st = cycleStatus(date, starts, ranges, prediction, bcMode);

  const startLog = periods.find((p) => p.start_date === date);
  const inRange = periodForDate(periods, date);

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={fmtLong(date)}>
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

        {!startLog && !inRange && prediction?.next && date >= (prediction.lo ?? date) && date <= (prediction.hi ?? date) && (
          <div className="day-info">
            <div className="day-info-label">{t.dayPredicted}</div>
            <div className="day-info-value">{t.dayPredictedValue}</div>
          </div>
        )}

        {!startLog && !inRange && !(prediction?.next && date >= (prediction.lo ?? date) && date <= (prediction.hi ?? date)) && prediction?.ov && (
          (() => {
            const o = Date.parse(prediction.ov + 'T00:00:00Z');
            const d = Date.parse(date + 'T00:00:00Z');
            if (d >= o - 5 * 864e5 && d <= o + 864e5) return (
              <div className="day-info">
                <div className="day-info-label">{t.dayFertile}</div>
                <div className="day-info-value">{date === prediction.ov ? t.dayOvulationValue : t.dayFertileValue}</div>
              </div>
            );
            return null;
          })()
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

        <div className="row">
          <button className="btn primary" onClick={() => onLog(date)}>{t.dayLogHere}</button>
          <button className="btn ghost" onClick={onClose}>{t.bcClose}</button>
        </div>
      </div>
    </>
  );
}
