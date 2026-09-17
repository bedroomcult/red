import { useState } from 'react';
import type { ReactNode } from 'react';
import { cycleStatus, type Phase } from '../lib/cycle';
import type { Period, Prediction } from './Calendar';
import { t } from './i18n';
import { localDate } from '../lib/today';
import { needsEndPrompt } from '../lib/cycle';
import OngoingPrompt from './OngoingPrompt';
import { apiFetch, readJson } from './api';

const SYMPTOMS = ['cramps', 'bloating', 'headache', 'mood', 'tired', 'breast', 'acne', 'craving'] as const;
const symLabel: Record<string, string> = {
  cramps: t.symCramps, bloating: t.symBloating, headache: t.symHeadache, mood: t.symMood,
  tired: t.symTired, breast: t.symBreast, acne: t.symAcne, craving: t.symCraving,
};

const fmtShort = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

// Gradient background per phase.
const GRAD: Record<Phase, string> = {
  period: 'radial-gradient(120% 100% at 50% 0%, #ff8a8f 0%, #e5484d 55%, #b3262b 100%)',
  fertile: 'radial-gradient(120% 100% at 50% 0%, #7fe0ad 0%, #30a46c 60%, #1d6b46 100%)',
  ovulation: 'radial-gradient(120% 100% at 50% 0%, #5fd39a 0%, #1d9e63 60%, #0f5c39 100%)',
  pms: 'radial-gradient(120% 100% at 50% 0%, #ffc6a3 0%, #e5784d 60%, #a84b26 100%)',
  neutral: 'radial-gradient(120% 100% at 50% 0%, #f2f2f5 0%, #d8d8de 55%, #b9b9c2 100%)',
  bc: 'radial-gradient(120% 100% at 50% 0%, #e6e6ea 0%, #c9c9d1 60%, #a8a8b3 100%)',
};
const LIGHT: Record<Phase, boolean> = { period: true, fertile: true, ovulation: true, pms: true, neutral: false, bc: false };

export default function Home({ me, onOpenCalendar, onLogToday, onLogout, onSaved }: {
  me: { periods: Period[]; prediction: Prediction; bc: { pill_type: string } | null; todaySymptoms?: string[]; today?: string; profile?: { period_len: number | null } | null };
  onOpenCalendar: () => void;
  onLogToday: (date: string) => void;
  onLogout: () => void;
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

  const light = LIGHT[st.phase];
  const fg = light ? '#fff' : '#1c1c1e';
  const sub = light ? 'rgba(255,255,255,.9)' : '#4a4a52';

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
    subtitle = me.prediction.next ? `${fmtShort(me.prediction.next)} · ${fmtShort(me.prediction.lo!)}–${fmtShort(me.prediction.hi!)}` : '';
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
      <div className="hero" style={{ background: GRAD[st.phase], color: fg }}>
        {/* The app name and logout live inside the hero so the gradient reaches
            the top of the screen. A separate header bar above it left a strip
            that was not part of the phase colour. */}
        <div className="hero-top">
          <span className="hero-app">{t.appName}</span>
          <button className="hero-logout" onClick={onLogout}>{t.logout}</button>
        </div>
        <div className="hero-body">
          <div className="hero-title">{title}</div>
          {subtitle && <div className="hero-sub" style={{ color: sub }}>{subtitle}</div>}
          {st.cycleDay !== null && st.phase !== 'period' && (
            <div className="hero-meta" style={{ color: sub }}>
              {t.homeCycleDay} {st.cycleDay}
            </div>
          )}
        </div>
      </div>

      <div className="home-lower">
        {ongoing && <OngoingPrompt period={ongoing} today={today} onSaved={onSaved} />}
        {(st.phase === 'period' || st.phase === 'pms' || st.phase === 'neutral') && (
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
        )}

        <div className="row" style={{ marginTop: 0 }}>
          <button className="btn primary" onClick={() => onLogToday(today)}>{t.homeLogToday}</button>
          <button className="btn" onClick={onOpenCalendar}>{t.homeSeeCalendar}</button>
        </div>
      </div>
    </div>
  );
}
