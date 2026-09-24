import { useEffect, useState } from 'react';
import { useEscape } from './useEscape';
import { cycleStatus, periodForDate, type Phase } from '../lib/cycle';
import { explainPrediction } from '../lib/predict';
import type { Dose, Period, Prediction, SexLog } from './Calendar';
import { t } from './i18n';
import { apiFetch, readJson } from './api';
import Icon from './Icon';

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

const SYMPTOMS = ['cramps', 'bloating', 'headache', 'mood', 'tired', 'breast', 'acne', 'craving'] as const;

const SYM_LABEL: Record<string, string> = {
  cramps: t.symCramps, bloating: t.symBloating, headache: t.symHeadache, mood: t.symMood,
  tired: t.symTired, breast: t.symBreast, acne: t.symAcne, craving: t.symCraving,
};

const fmtLong = (d: string) =>
  new Date(d + 'T00:00:00Z').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// Day view: a 2-column grid of icon cards. Tapping a card opens its editor in
// place; tapping again closes it. Only one card is open at a time. Period
// quick-log lives in the sixth card: one tap records, tapping again cancels.
// Full period detail (flow/end/spotting) stays in LogSheet via onLog, so a tap
// here is never an accidental commitment.
export default function DaySheet({ date, periods, prediction, bcMode, dose, sexLog, onDoseSaved, onLog, onClose }: {
  date: string;
  periods: Period[];
  prediction: Prediction | null;
  bcMode: boolean;
  dose: Dose | undefined;
  sexLog: SexLog | undefined;
  onDoseSaved: (state: any) => void;
  onLog: (date: string) => void;
  onClose: () => void;
}) {
  useEscape(true, onClose);
  const [syms, setSyms] = useState<string[] | null>(null);
  const [symErr, setSymErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteBusy, setNoteBusy] = useState(false);
  const [noteErr, setNoteErr] = useState<string | null>(null);
  const [doseBusy, setDoseBusy] = useState(false);
  const [doseErr, setDoseErr] = useState<string | null>(null);
  // Local echo of the parent's dose, so the buttons update before the refetch.
  const [doseLocal, setDoseLocal] = useState<boolean | null>(dose ? dose.taken : null);
  // Sex log: undefined = not logged, otherwise whether it was protected.
  const [sexLocal, setSexLocal] = useState<{ protected: boolean } | null>(sexLog ?? null);
  const [sexBusy, setSexBusy] = useState(false);
  const [sexErr, setSexErr] = useState<string | null>(null);
  // The one open card, if any. Reset per date so a new day starts collapsed.
  const [activeCard, setActiveCard] = useState<string | null>(null);
  const [periodBusy, setPeriodBusy] = useState(false);
  const [periodErr, setPeriodErr] = useState<string | null>(null);

  useEffect(() => { setDoseLocal(dose ? dose.taken : null); }, [date, dose]);
  useEffect(() => { setSexLocal(sexLog ?? null); }, [date, sexLog]);
  useEffect(() => { setActiveCard(null); setPeriodErr(null); }, [date]);

  useEffect(() => {
    let on = true;
    setSyms(null);
    setNote(null);
    setNoteDraft('');
    setSymErr(null);
    setNoteErr(null);
    apiFetch('/api/symptoms?date=' + date)
      .then((r) => (r.ok ? readJson(r) : { symptoms: [] }))
      .then((j) => { if (on) setSyms((j.symptoms ?? []).map((s: any) => s.kind)); })
      .catch(() => { if (on) setSyms([]); });
    apiFetch('/api/notes?date=' + date)
      .then((r) => (r.ok ? readJson(r) : { note: '' }))
      .then((j) => { if (on) { setNote(j.note ?? ''); setNoteDraft(j.note ?? ''); } })
      .catch(() => { if (on) { setNote(''); setNoteDraft(''); } });
    return () => { on = false; };
  }, [date]);

  const starts = periods.filter((p) => p.type === 'menstruation').map((p) => p.start_date);
  const ranges = periods.filter((p) => p.type === 'menstruation').map((p) => ({ start_date: p.start_date, end_date: p.end_date }));
  const st = cycleStatus(date, starts, ranges, prediction, bcMode);

  // Symptom toggle, optimistic like Home.tsx. Same POST toggles server-side.
  async function toggleSym(kind: string) {
    if (syms === null) return;
    const prev = syms;
    const next = prev.includes(kind) ? prev.filter((s) => s !== kind) : [...prev, kind];
    setSyms(next);
    setSymErr(null);
    try {
      const r = await apiFetch('/api/symptoms', { method: 'POST', body: JSON.stringify({ date, kind }) });
      if (!r.ok) throw new Error((await readJson(r)).error ?? r.statusText);
      const j = await readJson(r);
      setSyms((j.symptoms ?? []).map((s: any) => s.kind));
    } catch (e: any) {
      setSyms(prev);
      setSymErr(e.message);
    }
  }

  // Explicit save, not autosave: one request per tap instead of per keystroke.
  // Empty + save deletes the note, matching POST /api/notes.
  async function saveNote() {
    setNoteBusy(true);
    setNoteErr(null);
    try {
      const r = await apiFetch('/api/notes', { method: 'POST', body: JSON.stringify({ date, note: noteDraft }) });
      if (!r.ok) throw new Error((await readJson(r)).error ?? r.statusText);
      const j = await readJson(r);
      setNote(j.note ?? '');
    } catch (e: any) {
      setNoteErr(e.message);
    } finally {
      setNoteBusy(false);
    }
  }
  const noteDirty = note !== null && noteDraft !== note;

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

  // One-line verdict for the Kenapa card. The full reasoning lives in
  // PredictionDetail, which DaySheet no longer renders.
  const verdict = !reason ? null
    : reason.kind === 'in-window' ? t.dayPredictedValue
    : reason.kind === 'fertile' ? t.dayFertileValue
    : reason.kind === 'ovulation' ? t.dayOvulationValue
    : reason.kind === 'bc' ? t.predBcPaused
    : reason.kind === 'no-data' ? t.predNoData
    : t.predOutside;

  const toggle = (k: string) => setActiveCard((a) => (a === k ? null : k));

  // Quick-log inherits the last used flow so one tap records a sensible
  // default; changing flow, marking the end, or spotting stays in LogSheet.
  const lastFlow = [...periods].reverse().find((p) => p.type === 'menstruation' && p.flow)?.flow ?? 'medium';

  // Record (POST) or cancel (DELETE) this day's period. A mid-range date has
  // no new row to add, so it opens LogSheet to mark the end instead.
  async function quickPeriod() {
    if (startLog?.type === 'menstruation') {
      setPeriodBusy(true);
      setPeriodErr(null);
      try {
        const r = await apiFetch('/api/periods?id=' + startLog.id, { method: 'DELETE' });
        if (!r.ok) throw new Error((await readJson(r)).error ?? r.statusText);
        onDoseSaved(await readJson(r));
      } catch (e: any) {
        setPeriodErr(e.message);
      } finally {
        setPeriodBusy(false);
      }
      return;
    }
    if (inRange) { onLog(date); return; }
    setPeriodBusy(true);
    setPeriodErr(null);
    try {
      const r = await apiFetch('/api/periods', { method: 'POST', body: JSON.stringify({ start_date: date, type: 'menstruation', flow: lastFlow }) });
      if (!r.ok) throw new Error((await readJson(r)).error ?? r.statusText);
      onDoseSaved(await readJson(r));
    } catch (e: any) {
      setPeriodErr(e.message);
    } finally {
      setPeriodBusy(false);
    }
  }

  const flowLabel = (f: string | null) =>
    f === 'light' ? t.flowLight : f === 'heavy' ? t.flowHeavy : t.flowMedium;

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={fmtLong(date)}>
        <div className="sheet-body">
        <div className="grabber" />

        {/* Date header: the day number and month lead, so the sheet is
            identifiable at a glance without reading a long formatted string. */}
        <div className="day-head">
          <div className="day-head-date">
            <span className="day-head-num">{Number(date.slice(8, 10))}</span>
            <span className="day-head-mon">
              {new Date(date + 'T00:00:00Z').toLocaleDateString('id-ID', { month: 'long' })}
              <span className="day-head-year">{date.slice(0, 4)}</span>
            </span>
          </div>
          <div className="day-head-right">
            {/* One colour per phase family: rose = bleeding, amber = premenstrual
                warning, green = fertile window, grey = no signal. PMS previously
                reused the bleeding rose, so two unrelated phases looked alike. */}
            <span className={`badge ${PHASE_BADGE[st.phase]}`}>{PHASE_LABEL[st.phase]}</span>
            {st.cycleDay !== null && (
              <span className="day-head-day">{t.dayCycle.replace('{n}', String(st.cycleDay))}</span>
            )}
          </div>
        </div>

        <div className="day-grid">
          {/* Verdict card: static, not expandable. */}
          <div className="day-card">
            <div className="day-card-top"><Icon name="info" size={16} /><span>{t.predWhy}</span></div>
            <div className="day-card-value"><strong>{verdict ?? t.predNoData}</strong></div>
          </div>

          <div className={`day-card ${activeCard === 'sym' ? 'active' : ''}`}>
            <button type="button" className="day-card-top" aria-expanded={activeCard === 'sym'} onClick={() => toggle('sym')}>
              <Icon name="pulse" size={16} /><span>{t.daySymptoms}</span>
            </button>
            <div className="day-card-value">
              {syms === null ? (
                <span className="muted">{t.loading}</span>
              ) : syms.length ? (
                <div className="chips">
                  {syms.map((k) => (
                    <span key={k} className="sym-chip">{SYM_LABEL[k] ?? k}</span>
                  ))}
                </div>
              ) : (
                <span className="muted">{t.dayNoSymptoms}</span>
              )}
            </div>
            {activeCard === 'sym' && syms !== null && (
              <div className="day-card-editor">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {SYMPTOMS.map((k) => {
                    const on = syms.includes(k);
                    return (
                      <button key={k} className={`btn ${on ? 'on' : ''}`}
                        aria-pressed={on} onClick={() => toggleSym(k)}>
                        {SYM_LABEL[k]}
                      </button>
                    );
                  })}
                </div>
                {symErr && <div className="err">{symErr}</div>}
              </div>
            )}
          </div>

          <div className={`day-card ${activeCard === 'note' ? 'active' : ''}`}>
            <button type="button" className="day-card-top" aria-expanded={activeCard === 'note'} onClick={() => toggle('note')}>
              <Icon name="pencil" size={16} /><span>{t.note}</span>
            </button>
            <div className="day-card-value">
              {note === null ? (
                <span className="muted">{t.loading}</span>
              ) : note ? (
                <span className="day-note-text">{note}</span>
              ) : (
                <span className="muted">{t.dayNoNote}</span>
              )}
            </div>
            {activeCard === 'note' && note !== null && (
              <div className="day-card-editor">
                <textarea className="textarea" rows={2} value={noteDraft}
                  placeholder={t.notePlaceholder}
                  onChange={(e) => setNoteDraft(e.target.value)} />
                <div className="row tight">
                  <button className="btn" disabled={!noteDirty || noteBusy} onClick={saveNote}>
                    {t.setSave}
                  </button>
                </div>
                {noteErr && <div className="err">{noteErr}</div>}
              </div>
            )}
          </div>

          <div className={`day-card ${activeCard === 'dose' ? 'active' : ''}`}>
            <button type="button" className="day-card-top" aria-expanded={activeCard === 'dose'} onClick={() => toggle('dose')}>
              <Icon name="pill" size={16} /><span>{t.dayDose}</span>
            </button>
            <div className="day-card-value">
              {doseLocal === true ? t.doseTakenLabel
                : doseLocal === false ? t.doseMissedLabel
                : <span className="muted">{t.doseNone}</span>}
            </div>
            {activeCard === 'dose' && (
              <div className="day-card-editor">
                {/* Text chips, not icon buttons: check/cross/dash read as
                    right/wrong/clear rather than taken/missed/delete. Tapping the
                    active chip clears, so no third button is needed. */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} role="group" aria-label={t.dayDose}>
                  <button className={`btn ${doseLocal === true ? 'on' : ''}`} disabled={doseBusy}
                    aria-pressed={doseLocal === true}
                    onClick={() => setDose(doseLocal === true ? null : true)}>
                    {t.doseTaken}
                  </button>
                  <button className={`btn ${doseLocal === false ? 'on' : ''}`} disabled={doseBusy}
                    aria-pressed={doseLocal === false}
                    onClick={() => setDose(doseLocal === false ? null : false)}>
                    {t.doseMissed}
                  </button>
                </div>
                {doseErr && <div className="err">{doseErr}</div>}
              </div>
            )}
          </div>

          <div className={`day-card ${activeCard === 'sex' ? 'active' : ''}`}>
            <button type="button" className="day-card-top" aria-expanded={activeCard === 'sex'} onClick={() => toggle('sex')}>
              <Icon name="heart" size={16} /><span>{t.daySex}</span>
            </button>
            <div className="day-card-value">
              {sexLocal
                ? (sexLocal.protected ? t.sexProtectedLabel : t.sexUnprotectedLabel)
                : <span className="muted">{t.sexNone}</span>}
              {sexLocal && inFertile && (
                <div className="day-info-sub"><span className="badge">{t.sexFertileWarn}</span></div>
              )}
            </div>
            {activeCard === 'sex' && (
              <div className="day-card-editor">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} role="group" aria-label={t.daySex}>
                  <button className={`btn ${sexLocal?.protected === true ? 'on' : ''}`} disabled={sexBusy}
                    aria-pressed={sexLocal?.protected === true}
                    onClick={() => saveSex(sexLocal?.protected === true ? null : { protected: true })}>
                    {t.sexProtected}
                  </button>
                  <button className={`btn ${sexLocal && !sexLocal.protected ? 'on' : ''}`} disabled={sexBusy}
                    aria-pressed={!!sexLocal && !sexLocal.protected}
                    onClick={() => saveSex(sexLocal && !sexLocal.protected ? null : { protected: false })}>
                    {t.sexUnprotected}
                  </button>
                </div>
                {sexErr && <div className="err">{sexErr}</div>}
              </div>
            )}
          </div>

          <div className={`day-card ${activeCard === 'period' ? 'active' : ''}`}>
            <button type="button" className="day-card-top" aria-expanded={activeCard === 'period'} onClick={() => toggle('period')}>
              <Icon name="droplet" size={16} /><span>{t.dayPeriodLogged}</span>
            </button>
            <div className="day-card-value">
              {startLog ? (
                <>
                  {startLog.type === 'menstruation' ? t.legendPeriod : t.legendSpotting}
                  {startLog.flow ? ` · ${flowLabel(startLog.flow)}` : ''}
                  {startLog.end_date ? ` · ${t.dayUntil} ${fmtLong(startLog.end_date).replace(/^[^,]+,\s*/, '')}` : ` · ${t.dayOngoing}`}
                </>
              ) : inRange ? (
                t.dayInPeriodRange
              ) : (
                <span className="muted">{t.doseNone}</span>
              )}
            </div>
            {activeCard === 'period' && (
              <div className="day-card-editor">
                {periodErr && <div className="err">{periodErr}</div>}
                {!startLog && !inRange && (
                  <button className="btn primary" disabled={periodBusy} onClick={quickPeriod}>
                    {t.logPeriod}
                  </button>
                )}
                {startLog?.type === 'menstruation' && (
                  <button className="btn" disabled={periodBusy} onClick={quickPeriod}>
                    {t.exitNo}
                  </button>
                )}
                {inRange && !startLog && (
                  <button className="btn" onClick={() => onLog(date)}>
                    {t.ongoingEnded}
                  </button>
                )}
                {(startLog || inRange) && (
                  <div>
                    <button type="button" className="day-card-link" onClick={() => onLog(date)}>
                      {t.predMore}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        </div>

        <div className="sheet-actions">
          <button className="btn ghost" onClick={onClose}>{t.bcClose}</button>
        </div>
      </div>
    </>
  );
}
