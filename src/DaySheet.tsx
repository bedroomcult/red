import { useEffect, useState } from 'react';
import { cycleStatus, periodForDate, type Phase } from '../lib/cycle';
import { explainPrediction } from '../lib/predict';
import { symptomHistory } from '../lib/symptom-history';
import PredictionDetail from './PredictionDetail';
import type { Dose, Period, Prediction, SexLog } from './Calendar';
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

const PHASE_BADGE: Record<Phase, string> = {
  period: '',
  pms: 'amber',
  fertile: 'green',
  ovulation: 'green',
  neutral: 'grey',
  bc: 'grey',
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
export default function DaySheet({ date, periods, prediction, bcMode, dose, sexLog, symptomLog = [], onDoseSaved, onLog, onClose }: {
  date: string;
  periods: Period[];
  prediction: Prediction | null;
  bcMode: boolean;
  dose: Dose | undefined;
  sexLog: SexLog | undefined;
  symptomLog?: { date: string; kind: string }[];
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
  // Sex log: undefined = not logged, otherwise whether it was protected.
  const [sexLocal, setSexLocal] = useState<{ protected: boolean } | null>(sexLog ?? null);
  const [sexBusy, setSexBusy] = useState(false);
  const [sexErr, setSexErr] = useState<string | null>(null);

  useEffect(() => { setDoseLocal(dose ? dose.taken : null); }, [date, dose]);
  useEffect(() => { setSexLocal(sexLog ?? null); }, [date, sexLog]);

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

  // One log per day, so this either creates or replaces. Passing null clears it.
  async function saveSex(next: { protected: boolean } | null) {
    setSexBusy(true);
    setSexErr(null);
    const prev = sexLocal;
    setSexLocal(next);
    try {
      const r = next
        ? await apiFetch('/api/sex', { method: 'POST', body: JSON.stringify({ date, protected: next.protected }) })
        : await apiFetch('/api/sex?date=' + date, { method: 'DELETE' });
      if (!r.ok) throw new Error((await readJson(r)).error ?? r.statusText);
      onDoseSaved(await readJson(r));
    } catch (e: any) {
      setSexLocal(prev);
      setSexErr(e.message);
    } finally {
      setSexBusy(false);
    }
  }

  const startLog = periods.find((p) => p.start_date === date);
  const inRange = periodForDate(periods, date);
  const ov = prediction?.ov ? Date.parse(prediction.ov + 'T00:00:00Z') : null;
  const d = Date.parse(date + 'T00:00:00Z');
  // Fertile window = ovulation -5d .. +1d, matching lib/cycle.ts.
  const inFertile = ov !== null && d >= ov - 5 * 864e5 && d <= ov + 864e5;

  // Why this date reads the way it does. Rendered for every date, not only
  // predicted ones, so tapping an ordinary Tuesday still explains itself.
  const reason = prediction
    ? explainPrediction(
        date,
        periods.filter((p) => p.type === 'menstruation').map((p) => p.start_date),
        prediction,
        { bcMode }
      )
    : null;

  // Recurrence counts for the symptoms logged on this day, so a single entry is
  // shown against the user's own history rather than in isolation.
  const hist = symptomLog.length ? symptomHistory(symptomLog, periods, prediction, bcMode) : null;

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={fmtLong(date)}>
        <div className="sheet-body">
        <div className="grabber" />
        <h3 style={{ marginBottom: 4 }}>{fmtLong(date)}</h3>

        <div className="row tight" style={{ marginBottom: 12 }}>
          {/* One colour per phase family: rose = bleeding, amber = premenstrual
              warning, green = fertile window, grey = no signal. PMS previously
              reused the bleeding rose, so two unrelated phases looked alike. */}
          <span className={`badge ${PHASE_BADGE[st.phase]}`}>
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

        {/* A logged day already explained itself above. Every other date gets the
            reasoning: what the estimate is, how wide it is, and what it was
            computed from. */}
        {!startLog && !inRange && reason && <PredictionDetail date={date} reason={reason} />}

        <div className="day-group">
          <div className="day-info">
            <div className="day-info-label">{t.daySymptoms}</div>
            <div className="day-info-value">
              {syms === null ? t.loading
                : syms.length === 0 ? <span className="muted">{t.dayNoSymptoms}</span>
                : <span className="chips">{syms.map((k) => <span key={k} className="sym-chip">{SYM_LABEL[k] ?? k}</span>)}</span>}
            </div>
            {/* How often this day's symptoms recur, so one bad day reads against
                the user's own history rather than in isolation. Only shown when
                there is enough history to say something. */}
            {syms && syms.length > 0 && hist && (
              <div className="muted" style={{ marginTop: 6 }}>
                {syms.map((k) => {
                  const s = hist.stats.find((x) => x.kind === k);
                  if (!s || s.count < 2) return null;
                  return (
                    <div key={k}>
                      {SYM_LABEL[k] ?? k}: {s.count}×
                      {s.topPhase && <> · {t.symHistoryTopPhase.replace('{phase}', PHASE_LABEL[s.topPhase] ?? s.topPhase)}</>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="day-info">
            <div className="day-info-label">{t.note}</div>
            <div className="day-info-value">
              {note === null ? t.loading
                : note ? <span style={{ whiteSpace: 'pre-wrap' }}>{note}</span>
                : <span className="muted">{t.dayNoNote}</span>}
            </div>
          </div>
        </div>

        <div className="day-group">
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

          <div className="day-info">
            <div className="day-info-label">{t.daySex}</div>
            <div className="day-info-value">
              {sexLocal === null ? <span className="muted">{t.sexNone}</span>
                : sexLocal.protected ? t.sexProtectedLabel : t.sexUnprotectedLabel}
              {sexLocal && inFertile && <span className="badge" style={{ marginLeft: 8 }}>{t.sexFertileWarn}</span>}
            </div>
            <div className="row tight">
              <button className={`btn ${sexLocal?.protected === true ? 'on' : ''}`} disabled={sexBusy}
                aria-pressed={sexLocal?.protected === true} onClick={() => saveSex({ protected: true })}>{t.sexProtected}</button>
              <button className={`btn ${sexLocal && !sexLocal.protected ? 'on' : ''}`} disabled={sexBusy}
                aria-pressed={!!sexLocal && !sexLocal.protected} onClick={() => saveSex({ protected: false })}>{t.sexUnprotected}</button>
              {sexLocal !== null && (
                <button className="btn ghost" disabled={sexBusy} onClick={() => saveSex(null)}>{t.sexClear}</button>
              )}
            </div>
            {sexErr && <div className="err">{sexErr}</div>}
          </div>
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
