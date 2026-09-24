import { useState } from 'react';
import type { ReactNode } from 'react';
import { cycleStatus, type Phase } from '../lib/cycle';
import type { Period, Prediction } from './Calendar';
import { t } from './i18n';
import { localDate } from '../lib/today';
import { needsEndPrompt } from '../lib/cycle';
import OngoingPrompt from './OngoingPrompt';
import ChanceCard from './ChanceCard';
import { apiFetch, readJson } from './api';

const SYMPTOMS = ['cramps', 'bloating', 'headache', 'mood', 'tired', 'breast', 'acne', 'craving'] as const;
const symLabel: Record<string, string> = {
  cramps: t.symCramps, bloating: t.symBloating, headache: t.symHeadache, mood: t.symMood,
  tired: t.symTired, breast: t.symBreast, acne: t.symAcne, craving: t.symCraving,
};

const fmtShort = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

// Phase wash. A low-saturation atmospheric layer behind the text block, per
// DESIGN.md section 4, rather than a saturated field the text sits on. The old
// radial gradients put white text over stops as light as 1.45:1; a wash at this
// opacity keeps the text at full contrast while still signalling the phase.
const WASH: Record<Phase, string> = {
  period: 'linear-gradient(160deg, rgba(192,57,47,.18) 0%, rgba(192,57,47,.06) 100%)',
  fertile: 'linear-gradient(160deg, rgba(47,125,82,.18) 0%, rgba(47,125,82,.06) 100%)',
  ovulation: 'linear-gradient(160deg, rgba(31,107,69,.20) 0%, rgba(31,107,69,.07) 100%)',
  pms: 'linear-gradient(160deg, rgba(168,86,42,.18) 0%, rgba(168,86,42,.06) 100%)',
  neutral: 'linear-gradient(160deg, rgba(28,28,28,.06) 0%, rgba(28,28,28,.02) 100%)',
  bc: 'linear-gradient(160deg, rgba(28,28,28,.06) 0%, rgba(28,28,28,.02) 100%)',
};

// The accent bar under the title: one deliberate accent, carrying the phase.
const ACCENT: Record<Phase, string> = {
  period: 'var(--period)',
  fertile: 'var(--fertile)',
  ovulation: 'var(--ovulation)',
  pms: 'var(--pms)',
  neutral: 'var(--muted)',
  bc: 'var(--muted)',
};

export default function Home({ me, onOpenCalendar, onLogToday, onSaved }: {
  me: { periods: Period[]; prediction: Prediction; bc: { pill_type: string } | null; todaySymptoms?: string[]; today?: string; profile?: { period_len: number | null } | null };
  onOpenCalendar: () => void;
  onLogToday: (date: string) => void;
  onSaved: (s: any) => void;
}) {
  const today = me.today ?? localDate();
  const starts = me.periods.filter((p) => p.type === 'menstruation').map((p) => p.start_date);
  const ranges = me.periods.filter((p) => p.type === 'menstruation').map((p) => ({ start_date: p.start_date, end_date: p.end_date }));
  const bcMode = me.prediction.confidence === 'suppressed';
  const periodLen = me.profile?.period_len ?? 5;
  const st = cycleStatus(today, starts, ranges, me.prediction, bcMode, periodLen);
  const [syms, setSyms] = useState<string[]>(me.todaySymptoms ?? []);

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

  let title: ReactNode;
  let subtitle = '';
  if (st.phase === 'bc') {
    title = <>{t.homeBcTitle}</>;
    subtitle = t.homeBcSub;
  } else if (st.phase === 'period') {
    title = <>{t.homePeriodTitle.replace('{n}', String(st.cycleDay ?? 1))}</>;
    subtitle = t.homePeriodAsk;
  } else if (st.phase === 'ovulation') {
    title = <>{t.homeOvTitle}</>;
    subtitle = t.homeOvSub;
  } else if (st.phase === 'fertile') {
    title = <>{t.homeFertileTitle}</>;
    subtitle = t.homeFertileSub;
  } else if (st.phase === 'pms') {
    title = <>{t.homePmsTitle}</>;
    subtitle = t.homePmsSub;
  } else if (st.daysToNext !== null && st.daysToNext < 0) {
    title = <>{t.homeOverdue}</>;
    subtitle = `${Math.abs(st.daysToNext)} ${t.homeDays}`;
  } else if (st.daysToNext !== null) {
    title = <><span style={{ fontSize: 15, fontWeight: 500, display: 'block', marginBottom: 4 }}>{t.homeNeutral}</span><span style={{ fontSize: 56, fontWeight: 800, lineHeight: 1 }}>{st.daysToNext}</span><span style={{ fontSize: 18, marginLeft: 8 }}>{t.homeDays}</span></>;
    subtitle = me.prediction.next ? `${fmtShort(me.prediction.next)} · ${fmtShort(me.prediction.lo!)} sampai ${fmtShort(me.prediction.hi!)}` : '';
  } else {
    title = <>{t.homeNoData}</>;
  }

  // The ongoing period that has reached its expected length, if any. The user is
  // asked whether it is still going rather than the app guessing either way.
  const ongoing = me.periods.find(
    (p) => p.type === 'menstruation' && !p.end_date && needsEndPrompt(p, periodLen, today)
  );

  return (
    <div className="home-hero-wrap">
      <div className="hero" style={{ background: WASH[st.phase] }}>
        {/* Full-bleed: the .app wrapper's 16px side padding is cancelled so the
            gradient reaches both edges. The app name and logout live in the
            shared header above, so the hero carries only phase status. */}
        <div className="hero-body">
          <div className="hero-title">{title}</div>
          <div className="hero-accent" style={{ background: ACCENT[st.phase] }} />
          {subtitle && <div className="hero-sub">{subtitle}</div>}
          {st.cycleDay !== null && st.phase !== 'period' && (
            <div className="hero-meta">
              {t.homeCycleDay} {st.cycleDay}
            </div>
          )}
        </div>
      </div>

      <div className="home-lower">
        {ongoing && <OngoingPrompt period={ongoing} today={today} onSaved={onSaved} />}
        <ChanceCard date={today} prediction={me.prediction} bcMode={bcMode} />
        {/* Symptoms log in every phase: fertile-window symptoms are data,
            not noise, and hiding the chips loses exactly those days. */}
        <div className="card">
          <h2>{t.homeSymptomsToday}</h2>
          <div className="muted" style={{ marginTop: -6, marginBottom: 10 }}>{t.homeSymptomHint}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SYMPTOMS.map((k) => {
              const on = syms.includes(k);
              return (
                <button key={k} className={`btn ${on ? 'on' : ''}`} onClick={() => toggle(k)}
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
