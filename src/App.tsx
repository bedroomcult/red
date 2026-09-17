import { useCallback, useEffect, useState } from 'react';
import Calendar, { type Dose, type Period, type Prediction, type SexLog } from './Calendar';
import DaySheet from './DaySheet';
import LogSheet from './LogSheet';
import BcPanel from './BcPanel';
import EcPanel from './EcPanel';
import Home from './Home';
import InsightsScreen from './InsightsScreen';
import SettingsScreen from './SettingsScreen';
import Onboarding from './Onboarding';
import LoginScreen from './LoginScreen';
import Icon from './Icon';
import UpdateBanner from './UpdateBanner';
import Loading from './Loading';
import { applyTheme, loadTheme } from './theme';
import { t } from './i18n';
import type { Insights } from '../lib/insights';
import { periodForDate } from '../lib/cycle';
import { localDate } from '../lib/today';
import { apiFetch, readJson } from './api';

type Me = { periods: Period[]; bc: { pill_type: string; regimen: string } | null; ec: { id: string; ec_type: string; intake_at: string; upsi_at: string | null }[]; prediction: Prediction; todaySymptoms?: string[]; today?: string; doses?: Dose[]; sex?: SexLog[]; symptomLog?: { date: string; kind: string }[]; profile?: { display_name: string | null; cycle_len: number | null; period_len: number | null } | null; insights?: Insights };

const today = () => localDate();
const fmt = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtShort = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ym, setYm] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [sel, setSel] = useState<string | null>(null);
  const [logDate, setLogDate] = useState<string | null>(null);
  const [bcOpen, setBcOpen] = useState(false);
  const [ecOpen, setEcOpen] = useState(false);
  // The EC event being edited; undefined = a new one. `ecOpen` alone would lose
  // which row the user tapped.
  const [ecEditId, setEcEditId] = useState<string | null>(null);
  const [tab, setTab] = useState<'home' | 'calendar' | 'insights' | 'history' | 'settings'>('home');
  const [needLogin, setNeedLogin] = useState(false);
  const [onboarding, setOnboarding] = useState(false);

  // Apply saved theme on first paint.
  useEffect(() => { applyTheme(loadTheme()); }, []);

  const load = useCallback(async () => {
    try {
      const r = await apiFetch('/api/me');
      if (r.status === 401) { setNeedLogin(true); setErr(null); return; }
      if (!r.ok) throw new Error(r.statusText);
      setNeedLogin(false);
      setMe(await readJson(r));
    } catch (e: any) { setErr(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Performs the request only. It must not navigate: the login form shows a
  // success message first and calls finish() afterwards, so the confirmation is
  // visible before this screen unmounts.
  const doAuth = async (mode: 'login' | 'signup', email: string, password: string): Promise<{ error: string | null; finish: () => void }> => {
    setErr(null);
    try {
      const r = await apiFetch('/api/auth', {
        method: 'POST',
        body: JSON.stringify({ action: mode, email, password }),
      });
      const j = await readJson(r).catch(() => ({}));
      if (!r.ok) {
        const msg = (j as any).error;
        const text = msg === 'email taken' ? t.errTaken : msg === 'password min 8 chars' ? t.errMinPw : msg === 'invalid login' ? t.errLogin : (msg ?? t.errLogin);
        return { error: text, finish: () => {} };
      }
      const r2 = await apiFetch('/api/me');
      const st = r2.ok ? await readJson(r2) : null;
      // First run: no periods and no saved profile name => onboarding.
      if (st && (!st.periods?.length) && !st.profile?.display_name) {
        return {
          error: null,
          finish: () => { setMe(st); setNeedLogin(false); setOnboarding(true); },
        };
      }
      // Reuse the state already fetched here instead of calling load() again.
      // A second /api/me that failed would leave the user on the login screen
      // with no error at all.
      if (st) {
        return { error: null, finish: () => { setMe(st); setNeedLogin(false); } };
      }
      return { error: null, finish: () => { void load(); } };
    } catch (e: any) { return { error: e.message, finish: () => {} }; }
  };

  const doLogout = async () => {
    await apiFetch('/api/auth', { method: 'POST', body: JSON.stringify({ action: 'logout' }) });
    setMe(null);
    setNeedLogin(true);
  };

  const jumpToday = () => { const d = new Date(); setYm({ y: d.getFullYear(), m: d.getMonth() }); setSel(today()); };

  if (onboarding) {
    return <Onboarding onDone={(s) => { setMe(s); setOnboarding(false); }} />;
  }

  if (needLogin) {
    return <LoginScreen onAuth={doAuth} />;
  }

  const label = new Date(Date.UTC(ym.y, ym.m, 1)).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  // Period whose logged range (start..end, or start+4 default) contains a date.
  const activeFor = (d: string) => periodForDate(me?.periods ?? [], d);
  const flags = me?.prediction.flags ?? [];
  const bcMode = me?.prediction.confidence === 'suppressed' || flags.includes('bc-suppressed');
  const ecHit = flags.includes('ec-disrupted');
  // Most recent EC event within the query window, shown as a status line so an
  // active dose is visible without opening the panel.
  const latestEc = me?.ec?.length ? me.ec[0] : null;
  const history = me ? [...me.periods].sort((a, b) => b.start_date.localeCompare(a.start_date)) : [];
  const conf = (me?.prediction.confidence ?? 'low') as keyof typeof t.confidence;

  return (
    <div className="app">
      <div className="top">
        <h1>{t.appName}</h1>
      </div>

      {err && <div className="err">{err}</div>}

      <UpdateBanner />

      {bcMode && <div className="banner warn">{t.bcSuppressed}: {me?.bc?.pill_type ?? ''} ({me?.bc?.regimen ?? ''}). {t.bcHint}</div>}
      {ecHit && (
        <div className="banner warn ec-banner">
          <div>
            <strong>{t.ecActive}</strong>
            {latestEc && <span className="ec-when"> · {latestEc.intake_at.slice(0, 10)}</span>}
            <div className="ec-hint">{t.ecActiveHint}</div>
          </div>
          <div className="row tight">
            <button className="btn" onClick={() => { setEcEditId(latestEc?.id ?? null); setEcOpen(true); }}>{t.ecEdit}</button>
          </div>
        </div>
      )}

      {!me && !err && <Loading />}

      {me && tab === 'home' && (
        <Home
          me={me}
          onOpenCalendar={() => setTab('calendar')}
          onLogToday={(d) => { const dt = new Date(d + 'T00:00:00Z'); setYm({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() }); setSel(d); setLogDate(d); }}
          onSaved={setMe}
        />
      )}

      {me && tab === 'calendar' && (
        <>
          <div className="card">
            <div className="month-nav">
              <button className="nav-btn" onClick={() => setYm(v => ({ y: v.m === 0 ? v.y - 1 : v.y, m: (v.m + 11) % 12 }))}>‹</button>
              <strong>{label}</strong>
              <button className="nav-btn" onClick={() => setYm(v => ({ y: v.m === 11 ? v.y + 1 : v.y, m: (v.m + 1) % 12 }))}>›</button>
            </div>
            <Calendar year={ym.y} mon={ym.m} periods={me.periods} prediction={me.prediction} selected={sel} onPick={setSel} doses={me.doses ?? []} sex={me.sex ?? []} futureStarts={me.insights?.next6 ?? []} periodLen={me.profile?.period_len ?? 5} />
            <div className="legend">
              <div className="legend-group">
                <span><i className="chip logged" />{t.legendPeriod}</span>
                <span><i className="chip spot" />{t.legendSpotting}</span>
                <span><i className="chip sex" />{t.legendSex}</span>
              </div>
              <div className="legend-group">
                <span><i className="chip period" />{t.legendPredicted}</span>
                <span><i className="chip fertile" />{t.legendFertile}</span>
                <span><i className="chip ovulation" />{t.legendOvulation}</span>
              </div>
              <div className="legend-group">
                <span><i className="chip dose-taken" />{t.legendDoseTaken}</span>
                <span><i className="chip dose-missed" />{t.legendDoseMissed}</span>
              </div>
            </div>
          </div>

          <div className="card next-card">
            <h2>{t.nextPeriod}</h2>
            {(() => {
              // Never show a prediction whose date has already passed. The server
              // rolls the window forward, but a stale cached state or a device
              // clock ahead of the API could still deliver one.
              const next = me.prediction.next;
              const today = me.today ?? localDate();
              if (!next || next < today) {
                return <div className="muted">{next ? t.noPredictionPast : t.notEnough}</div>;
              }
              // Lead with how many days away it is: that is the number people
              // actually want, and it reads at a glance where a date does not.
              const days = Math.round((Date.parse(next + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 864e5);
              return (
                <>
                  <div className="next-count">
                    <span className="next-num">{days}</span>
                    <span className="next-unit">{days === 0 ? t.homeToday : t.insDays}</span>
                  </div>
                  <div className="next-date">{fmt(next)}</div>
                  <div className="next-range">
                    <span className="next-range-label">{t.nextWindow}</span>
                    <span className="next-range-value">{fmtShort(me.prediction.lo!)} - {fmtShort(me.prediction.hi!)}</span>
                  </div>
                </>
              );
            })()}
            <div className="row tight next-badges">
              <span className={`badge ${conf === 'high' ? 'green' : conf === 'med' ? '' : 'grey'}`}>{t.confidence[conf] ?? t.confidence.low}</span>
              {flags.includes('estimated') && <span className="badge grey">{t.estimated}</span>}
              {flags.includes('disrupted') && <span className="badge">{t.disrupted}</span>}
              {flags.includes('irregular') && <span className="badge grey">{t.irregular}</span>}
            </div>
            <div className="row">
              <button className="btn primary" onClick={jumpToday}>{t.today}</button>
              <button className="btn" onClick={() => setBcOpen(true)}>{t.bc}</button>
              <button className="btn" onClick={() => { setEcEditId(null); setEcOpen(true); }}>{t.ecLog}</button>
            </div>
          </div>
        </>
      )}

      {me && tab === 'history' && (
        <div className="card">
          <h2>{t.history}</h2>
          {history.length === 0 && <div className="muted">{t.nothing}</div>}
          <ul className="list">
            {history.map((p) => (
              <li key={p.id}>
                <button className="btn" onClick={() => setSel(p.start_date)} style={{ padding: '6px 12px' }}>{fmt(p.start_date)}</button>
                <span className="meta">
                  {p.type === 'menstruation' ? t.legendPeriod : t.legendSpotting}
                  {p.flow ? ` · ${p.flow === 'light' ? t.flowLight : p.flow === 'heavy' ? t.flowHeavy : t.flowMedium}` : ''}
                  {p.end_date ? ` · ${fmt(p.end_date)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {me && tab === 'insights' && (
        <InsightsScreen
          ins={me.insights ?? { avgCycle: null, avgPeriod: null, variability: null, count: 0, shortest: null, longest: null, estimated: true, next6: [] }}
          periods={me.periods}
          prediction={me.prediction}
          bcMode={bcMode}
          symptomLog={me.symptomLog ?? []}
        />
      )}

      {me && tab === 'settings' && (
        <SettingsScreen profile={me.profile ?? null} nextPeriod={me.prediction.next}
          onSaved={setMe} onLogout={doLogout} />
      )}

      {sel && !logDate && (
        <DaySheet
          date={sel}
          periods={me?.periods ?? []}
          prediction={me?.prediction ?? null}
          bcMode={bcMode}
          dose={me?.doses?.find((d) => d.date === sel)}
          sexLog={me?.sex?.find((s) => s.date === sel)}
          symptomLog={me?.symptomLog ?? []}
          onDoseSaved={setMe}
          onLog={(d) => setLogDate(d)}
          onClose={() => setSel(null)}
        />
      )}
      {logDate && <LogSheet date={logDate} existing={me?.periods.find((p) => p.start_date === logDate)} active={activeFor(logDate)} onClose={() => setLogDate(null)} onSaved={(s) => { setMe(s); setLogDate(null); setSel(null); }} />}
      {bcOpen && <BcPanel current={me?.bc ?? null} onClose={() => setBcOpen(false)} onSaved={setMe} />}
      {ecOpen && (
        <EcPanel
          events={(me?.ec ?? []) as any}
          current={ecEditId ? (me?.ec ?? []).find((e) => e.id === ecEditId) ?? null : null}
          onClose={() => { setEcOpen(false); setEcEditId(null); }}
          onSaved={setMe}
        />
      )}

      <footer className="disclaimer">{t.disclaimer}</footer>

      <nav className="tabbar">
        <button className={`tab ${tab === 'home' ? 'active' : ''}`} aria-current={tab === 'home' ? 'page' : undefined} onClick={() => setTab('home')}>
          <Icon name="home" />{t.navHome}
        </button>
        <button className={`tab ${tab === 'calendar' ? 'active' : ''}`} aria-current={tab === 'calendar' ? 'page' : undefined} onClick={() => setTab('calendar')}>
          <Icon name="calendar" />{t.navCalendar}
        </button>
        <button className={`tab ${tab === 'insights' ? 'active' : ''}`} aria-current={tab === 'insights' ? 'page' : undefined} onClick={() => setTab('insights')}>
          <Icon name="insights" />{t.navInsights}
        </button>
        <button className={`tab ${tab === 'history' ? 'active' : ''}`} aria-current={tab === 'history' ? 'page' : undefined} onClick={() => setTab('history')}>
          <Icon name="history" />{t.navHistory}
        </button>
        <button className={`tab ${tab === 'settings' ? 'active' : ''}`} aria-current={tab === 'settings' ? 'page' : undefined} onClick={() => setTab('settings')}>
          <Icon name="settings" />{t.navSettings}
        </button>
      </nav>
    </div>
  );
}
