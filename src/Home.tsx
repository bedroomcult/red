import { useState } from 'react';
import { cycleStatus, type Phase } from '../lib/cycle';
import type { Period, Prediction } from './Calendar';
import { t } from './i18n';
import { localDate } from '../lib/today';
import { needsEndPrompt } from '../lib/cycle';
import OngoingPrompt from './OngoingPrompt';
import ChanceCard from './ChanceCard';
import CycleRing from './CycleRing';
import WeekStrip from './WeekStrip';
import { makeDayState } from './dayState';
import { apiFetch, readJson } from './api';

const SYMPTOMS = ['cramps', 'bloating', 'headache', 'mood', 'tired', 'breast', 'acne', 'craving'] as const;
const symLabel: Record<string, string> = {
  cramps: t.symCramps, bloating: t.symBloating, headache: t.symHeadache, mood: t.symMood,
  tired: t.symTired, breast: t.symBreast, acne: t.symAcne, craving: t.symCraving,
};

const fmtShort = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

// The phase dot colour, restated as text beside the ring so colour is never the
// only signal. Mirrors the ring arc and the calendar.
const PHASE_DOT: Record<Phase, string> = {
  period: 'var(--period)',
  fertile: 'var(--fertile)',
  ovulation: 'var(--ovulation)',
  pms: 'var(--pms)',
  neutral: 'var(--neutral)',
  bc: 'var(--neutral)',
};

const PHASE_LABEL: Record<Phase, string> = {
  period: t.phasePeriod,
  fertile: t.phaseFertile,
  ovulation: t.phaseOvulation,
  pms: t.phasePms,
  neutral: t.phaseNeutral,
  bc: t.phaseBc,
};

export default function Home({ me, onOpenCalendar, onLogToday, onSaved }: {
  me: { periods: Period[]; prediction: Prediction; bc: { pill_type: string } | null; todaySymptoms?: string[]; today?: string; profile?: { period_len: number | null; cycle_len: number | null } | null; insights?: { avgCycle: number | null } | null };
  onOpenCalendar: () => void;
  onLogToday: (date: string) => void;
  onSaved: (s: any) => void;
}) {
  const today = me.today ?? localDate();
  const [sel, setSel] = useState(today);
  const starts = me.periods.filter((p) => p.type === 'menstruation').map((p) => p.start_date);
  const ranges = me.periods.filter((p) => p.type === 'menstruation').map((p) => ({ start_date: p.start_date, end_date: p.end_date }));
  const bcMode = me.prediction.confidence === 'suppressed';
  const periodLen = me.profile?.period_len ?? 5;
  // The dial must share its denominator with the prediction, or the arc and the
  // "in N days" line contradict each other. Prefer the observed average the
  // prediction is built from, falling back to the configured length.
  const cycleLen = me.insights?.avgCycle ?? me.profile?.cycle_len ?? 28;
  const st = cycleStatus(sel, starts, ranges, me.prediction, bcMode, periodLen);
  const [syms, setSyms] = useState<string[]>(me.todaySymptoms ?? []);

  // Dates inside a logged period, for the week-strip dot.
  // One classifier shared with the calendar, so both surfaces mark days alike.
  const dayState = makeDayState({
    periods: me.periods,
    prediction: me.prediction,
    futureStarts: me.insights?.next6 ?? [],
    periodLen,
  });

  // Predicted ovulation and next start as cycle-day offsets, for the ring arcs.
  const anchor = starts.length ? starts[starts.length - 1] : null;
  const toCycleDay = (d: string | null) => (d && anchor
    ? Math.round((Date.parse(d + 'T00:00:00Z') - Date.parse(anchor + 'T00:00:00Z')) / 864e5) + 1
    : null);
  const ovDay = toCycleDay(me.prediction.ov);
  const nextStart = toCycleDay(me.prediction.next);

  async function toggle(kind: string) {
    const next = syms.includes(kind) ? syms.filter((s) => s !== kind) : [...syms, kind];
    setSyms(next); // optimistic
    try {
      const r = await apiFetch('/api/symptoms', {
        method: 'POST',         body: JSON.stringify({ date: today, kind }),
      });
      if (!r.ok) throw new Error('save failed');
      const j = await readJson(r);
      setSyms(j.symptoms.map((s: any) => s.kind));
    } catch { setSyms(syms); }
  }

  let title: string;
  let subtitle = '';
  if (st.phase === 'bc') {
    title = t.homeBcTitle;
    subtitle = t.homeBcSub;
  } else if (st.phase === 'period') {
    title = t.homePeriodTitle.replace('{n}', String(st.cycleDay ?? 1));
    subtitle = t.homePeriodAsk;
  } else if (st.phase === 'ovulation') {
    title = t.homeOvTitle;
    subtitle = t.homeOvSub;
  } else if (st.phase === 'fertile') {
    title = t.homeFertileTitle;
    subtitle = t.homeFertileSub;
  } else if (st.phase === 'pms') {
    title = t.homePmsTitle;
    subtitle = t.homePmsSub;
  } else if (st.daysToNext !== null && st.daysToNext < 0) {
    title = t.homeOverdue;
    subtitle = `${Math.abs(st.daysToNext)} ${t.homeDays}`;
  } else if (st.daysToNext !== null) {
    title = `${st.daysToNext} ${t.homeDays}`;
    subtitle = me.prediction.next ? `${fmtShort(me.prediction.next)} · ${fmtShort(me.prediction.lo!)} sampai ${fmtShort(me.prediction.hi!)}` : '';
  } else {
    title = t.homeNoData;
  }

  // The ongoing period that has reached its expected length, if any. The user is
  // asked whether it is still going rather than the app guessing either way.
  const ongoing = me.periods.find(
    (p) => p.type === 'menstruation' && !p.end_date && needsEndPrompt(p, periodLen, today)
  );

  return (
    <div className="home-hero-wrap">
      <WeekStrip selected={sel} today={today} dayClass={dayState} onPick={setSel} />

      <div className="ring-card">
        <CycleRing
          day={st.cycleDay}
          total={cycleLen}
          phase={st.phase}
          periodLen={periodLen}
          ovDay={ovDay}
          nextStart={nextStart}
        />
        <div className="ring-copy">
          <h1 className="ring-title">{title}</h1>
          {subtitle && <div className="ring-sub">{subtitle}</div>}
          {/* Phase restated as text + dot, so the dial colour is never the only
              carrier of meaning. */}
          <div className="ring-phase">
            <span className="ring-dot" style={{ background: PHASE_DOT[st.phase] }} aria-hidden="true" />
            {PHASE_LABEL[st.phase]}
          </div>
        </div>
      </div>

      <div className="home-lower">
        {ongoing && <OngoingPrompt period={ongoing} today={today} onSaved={onSaved} />}
        <ChanceCard date={today} prediction={me.prediction} bcMode={bcMode} />
        {/* Symptoms log in every phase: fertile-window symptoms are data,
            not noise, and hiding the chips loses exactly those days. */}
        <div className="card">
          <h2>{t.homeSymptomsToday}</h2>
          <div className="muted" style={{ marginTop: 'calc(-1 * var(--s-3))', marginBottom: 'var(--s-3)' }}>{t.homeSymptomHint}</div>
          <div className="chips">
            {SYMPTOMS.map((k) => {
              const on = syms.includes(k);
              return (
                <button key={k} className={`chip-btn ${on ? 'on' : ''}`} onClick={() => toggle(k)}
                  aria-pressed={on}>
                  {symLabel[k]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="row" style={{ marginTop: 0 }}>
          <button className="btn primary" onClick={() => onLogToday(today)}>{t.homeLogToday}</button>
          <button className="btn" onClick={onOpenCalendar}>{t.homeSeeCalendar}</button>
        </div>
      </div>
    </div>
  );
}
