import { useCallback, useEffect, useState } from 'react';
import Calendar, { type Period, type Prediction } from './Calendar';
import LogSheet from './LogSheet';
import BcPanel from './BcPanel';
import EcPanel from './EcPanel';
import Home from './Home';
import InsightsScreen from './InsightsScreen';
import SettingsScreen from './SettingsScreen';
import Onboarding from './Onboarding';
import { applyTheme, loadTheme } from './theme';
import { t } from './i18n';
import type { Insights } from '../lib/insights';
import { localDate, dateHeaders } from '../lib/today';

type Me = { periods: Period[]; bc: { pill_type: string; regimen: string } | null; ec: { ec_type: string; intake_at: string }[]; prediction: Prediction; todaySymptoms?: string[]; today?: string; profile?: { display_name: string | null; cycle_len: number | null; period_len: number | null } | null; insights?: Insights };

const today = () => localDate();
const fmt = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ym, setYm] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [sel, setSel] = useState<string | null>(null);
  const [bcOpen, setBcOpen] = useState(false);
  const [ecOpen, setEcOpen] = useState(false);
  const [tab, setTab] = useState<'home' | 'calendar' | 'insights' | 'history' | 'settings'>('home');
  const [login, setLogin] = useState({ email: '', password: '', mode: 'login' as 'login' | 'signup' });
  const [needLogin, setNeedLogin] = useState(false);
  const [onboarding, setOnboarding] = useState(false);

  // Apply saved theme on first paint.
  useEffect(() => { applyTheme(loadTheme()); }, []);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/me', { headers: dateHeaders() });
      if (r.status === 401) { setNeedLogin(true); setErr(null); return; }
      if (!r.ok) throw new Error(r.statusText);
      setNeedLogin(false);
      setMe(await r.json());
    } catch (e: any) { setErr(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const doAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const r = await fetch('/api/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...dateHeaders() },
        body: JSON.stringify({ action: login.mode, email: login.email, password: login.password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = (j as any).error;
        setErr(msg === 'email taken' ? t.errTaken : msg === 'password min 8 chars' ? t.errMinPw : msg === 'invalid login' ? t.errLogin : (msg ?? t.errLogin));
        return;
      }
      setLogin({ email: '', password: '', mode: 'login' });
      const r2 = await fetch('/api/me', { headers: dateHeaders() });
      const st = r2.ok ? await r2.json() : null;
      // First run: no periods and no saved profile name => onboarding.
      if (st && (!st.periods?.length) && !st.profile?.display_name) {
        setMe(st);
        setNeedLogin(false);
        setOnboarding(true);
        return;
      }
      await load();
    } catch (e: any) { setErr(e.message); }
  };

  const doLogout = async () => {
    await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json', ...dateHeaders() }, body: JSON.stringify({ action: 'logout' }) });
    setMe(null);
    setNeedLogin(true);
  };

  const jumpToday = () => { const d = new Date(); setYm({ y: d.getFullYear(), m: d.getMonth() }); setSel(today()); };

  if (onboarding) {
    return <Onboarding onDone={(s) => { setMe(s); setOnboarding(false); }} />;
  }

  if (needLogin) {
    return (
      <div className="app auth">
        <h1>{t.appName}</h1>
        <div className="sub">{t.loginSubtitle}</div>
        <form onSubmit={doAuth}>
          <div className="field">
            <label htmlFor="auth-email">{t.email}</label>
            <input id="auth-email" type="email" required autoComplete="email" value={login.email}
              onChange={(e) => setLogin({ ...login, email: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="auth-pw">{t.password}</label>
            <input id="auth-pw" type="password" required minLength={8}
              autoComplete={login.mode === 'login' ? 'current-password' : 'new-password'}
              value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
          </div>
          {err && <div className="err">{err}</div>}
          <div className="row">
            <button className="btn primary" type="submit" style={{ flex: 1 }}>
              {login.mode === 'login' ? t.login : t.signup}
            </button>
          </div>
          <div className="row tight">
            <button className="btn ghost" type="button"
              onClick={() => setLogin({ ...login, mode: login.mode === 'login' ? 'signup' : 'login' })}>
              {login.mode === 'login' ? t.needAccount : t.haveAccount}
            </button>
          </div>
        </form>
        <footer className="disclaimer">{t.disclaimer}</footer>
      </div>
    );
  }

  const label = new Date(Date.UTC(ym.y, ym.m, 1)).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  const existing = sel ? me?.periods.find((p) => p.start_date === sel) : undefined;
  // Period whose logged range (start..end, or start+4 default) contains sel.
  const active = sel ? me?.periods.find((p) => {
    const s = p.start_date;
    const e = p.end_date ?? new Date(Date.parse(s + 'T00:00:00Z') + 4 * 864e5).toISOString().slice(0, 10);
    return sel >= s && sel <= e;
  }) : undefined;
  const flags = me?.prediction.flags ?? [];
  const bcMode = me?.prediction.confidence === 'suppressed' || flags.includes('bc-suppressed');
  const ecHit = flags.includes('ec-disrupted');
  const history = me ? [...me.periods].sort((a, b) => b.start_date.localeCompare(a.start_date)) : [];
  const conf = (me?.prediction.confidence ?? 'low') as keyof typeof t.confidence;

  return (
    <div className="app">
      <div className="top" style={tab === 'home' ? { marginBottom: 0 } : undefined}>
        <h1>{t.appName}</h1>
        <button className="icon-btn" onClick={doLogout}>{t.logout}</button>
      </div>

      {err && <div className="err">{err}</div>}

      {bcMode && <div className="banner warn">{t.bcSuppressed} — {me?.bc?.pill_type ?? ''} ({me?.bc?.regimen ?? ''}). {t.bcHint}</div>}
      {ecHit && <div className="banner warn">{t.ecDisrupted}</div>}

      {!me && !err && <div className="spinner" role="status" aria-label={t.loading} />}

      {me && tab === 'home' && (
        <Home
          me={me}
          onOpenCalendar={() => setTab('calendar')}
          onLogToday={(d) => { const dt = new Date(d + 'T00:00:00Z'); setYm({ y: dt.getUTCFullYear(), m: dt.getUTCMonth() }); setSel(d); }}
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
            <Calendar year={ym.y} mon={ym.m} periods={me.periods} prediction={me.prediction} selected={sel} onPick={setSel} />
            <div className="legend">
              <span><i className="chip period" />{t.legendPeriod}</span>
              <span><i className="chip fertile" />{t.legendFertile}</span>
              <span><i className="chip logged" />{t.legendPredicted}</span>
              <span><i className="chip spot" />{t.legendSpotting}</span>
            </div>
          </div>

          <div className="card">
            <h2>{t.nextPeriod}</h2>
            {me.prediction.next ? (
              <div className="pred">
                <span className="big">{fmt(me.prediction.next)}</span>
                <span className="badge">{fmt(me.prediction.lo!)} – {fmt(me.prediction.hi!)}</span>
              </div>
            ) : (
              <div className="muted">{t.notEnough}</div>
            )}
            <div className="row tight">
              <span className={`badge ${conf === 'high' ? 'green' : conf === 'med' ? '' : 'grey'}`}>{t.confidence[conf] ?? t.confidence.low}</span>
              {flags.includes('estimated') && <span className="badge grey">{t.estimated}</span>}
              {flags.includes('irregular') && <span className="badge grey">{t.irregular}</span>}
            </div>
            <div className="row">
              <button className="btn primary" onClick={jumpToday}>{t.today}</button>
              <button className="btn" onClick={() => setBcOpen(true)}>{t.bc}</button>
              <button className="btn" onClick={() => setEcOpen(true)}>{t.ecLog}</button>
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
        <InsightsScreen ins={me.insights ?? { avgCycle: null, avgPeriod: null, variability: null, count: 0, shortest: null, longest: null, next3: [] }} />
      )}

      {me && tab === 'settings' && (
        <SettingsScreen profile={me.profile ?? null} nextPeriod={me.prediction.next}
          onSaved={setMe} onLogout={doLogout} />
      )}

      {sel && <LogSheet date={sel} existing={existing} active={active} onClose={() => setSel(null)} onSaved={setMe} />}
      {bcOpen && <BcPanel current={me?.bc ?? null} onClose={() => setBcOpen(false)} onSaved={setMe} />}
      {ecOpen && <EcPanel onClose={() => setEcOpen(false)} onSaved={setMe} />}

      <footer className="disclaimer">{t.disclaimer}</footer>

      <nav className="tabbar">
        <button className={`tab ${tab === 'home' ? 'active' : ''}`} aria-current={tab === 'home' ? 'page' : undefined} onClick={() => setTab('home')}>
          <span className="ico" aria-hidden="true">💗</span>{t.navHome}
        </button>
        <button className={`tab ${tab === 'calendar' ? 'active' : ''}`} aria-current={tab === 'calendar' ? 'page' : undefined} onClick={() => setTab('calendar')}>
          <span className="ico" aria-hidden="true">📅</span>{t.navCalendar}
        </button>
        <button className={`tab ${tab === 'insights' ? 'active' : ''}`} aria-current={tab === 'insights' ? 'page' : undefined} onClick={() => setTab('insights')}>
          <span className="ico" aria-hidden="true">📊</span>{t.navInsights}
        </button>
        <button className={`tab ${tab === 'history' ? 'active' : ''}`} aria-current={tab === 'history' ? 'page' : undefined} onClick={() => setTab('history')}>
          <span className="ico" aria-hidden="true">🕘</span>{t.navHistory}
        </button>
        <button className={`tab ${tab === 'settings' ? 'active' : ''}`} aria-current={tab === 'settings' ? 'page' : undefined} onClick={() => setTab('settings')}>
          <span className="ico" aria-hidden="true">⚙️</span>{t.navSettings}
        </button>
      </nav>
    </div>
  );
}
