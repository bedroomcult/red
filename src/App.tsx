import { useCallback, useEffect, useState } from 'react';
import Calendar, { type Period, type Prediction } from './Calendar';
import LogSheet from './LogSheet';
import BcPanel from './BcPanel';
import EcPanel from './EcPanel';
import Home from './Home';
import InsightsScreen from './InsightsScreen';
import SettingsScreen from './SettingsScreen';
import { t } from './i18n';
import type { Insights } from '../lib/insights';

type Me = { periods: Period[]; bc: { pill_type: string; regimen: string } | null; ec: { ec_type: string; intake_at: string }[]; prediction: Prediction; todaySymptoms?: string[]; today?: string; profile?: { display_name: string | null; cycle_len: number | null; period_len: number | null } | null; insights?: Insights };

const today = () => new Date().toISOString().slice(0, 10);
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

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/me');
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: login.mode, email: login.email, password: login.password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = (j as any).error;
        setErr(msg === 'email taken' ? t.errTaken : msg === 'password min 8 chars' ? t.errMinPw : msg === 'invalid login' ? t.errLogin : (msg ?? t.errLogin));
        return;
      }
      setLogin({ email: '', password: '', mode: 'login' });
      await load();
    } catch (e: any) { setErr(e.message); }
  };

  const doLogout = async () => {
    await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
    setMe(null);
    setNeedLogin(true);
  };

  const jumpToday = () => { const d = new Date(); setYm({ y: d.getFullYear(), m: d.getMonth() }); setSel(today()); };

  if (needLogin) {
    return (
      <div className="app auth">
        <h1>{t.appName}</h1>
        <div className="sub">{t.loginSubtitle}</div>
        <form onSubmit={doAuth}>
          <div className="field">
            <label>{t.email}</label>
            <input type="email" required autoComplete="email" value={login.email}
              onChange={(e) => setLogin({ ...login, email: e.target.value })} />
          </div>
          <div className="field">
            <label>{t.password}</label>
            <input type="password" required minLength={8}
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
  const flags = me?.prediction.flags ?? [];
  const bcMode = me?.prediction.confidence === 'suppressed' || flags.includes('bc-suppressed');
  const ecHit = flags.includes('ec-disrupted');
  const history = me ? [...me.periods].sort((a, b) => b.start_date.localeCompare(a.start_date)) : [];
  const conf = (me?.prediction.confidence ?? 'low') as keyof typeof t.confidence;

  return (
    <div className="app">
      {tab !== 'home' && (
        <div className="top">
          <h1>{t.appName}</h1>
          <button className="icon-btn" onClick={doLogout}>{t.logout}</button>
        </div>
      )}
      {tab === 'home' && (
        <div className="top" style={{ marginBottom: 0 }}>
          <h1>{t.appName}</h1>
          <button className="icon-btn" onClick={doLogout}>{t.logout}</button>
        </div>
      )}

      {err && <div className="err">{err}</div>}

      {bcMode && <div className="banner warn">{t.bcSuppressed} — {me?.bc?.pill_type ?? ''} ({me?.bc?.regimen ?? ''}). {t.bcHint}</div>}
      {ecHit && <div className="banner warn">{t.ecDisrupted}</div>}

      {!me && !err && <div className="muted">{t.loading}</div>}

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
        <SettingsScreen profile={me.profile ?? null} onSaved={setMe} onLogout={doLogout} />
      )}

      {sel && <LogSheet date={sel} existing={existing} onClose={() => setSel(null)} onSaved={setMe} />}
      {bcOpen && <BcPanel current={me?.bc ?? null} onClose={() => setBcOpen(false)} onSaved={setMe} />}
      {ecOpen && <EcPanel onClose={() => setEcOpen(false)} onSaved={setMe} />}

      <footer className="disclaimer">{t.disclaimer}</footer>

      <nav className="tabbar">
        <button className={`tab ${tab === 'home' ? 'active' : ''}`} onClick={() => setTab('home')}>
          <span className="ico">💗</span>{t.navHome}
        </button>
        <button className={`tab ${tab === 'calendar' ? 'active' : ''}`} onClick={() => setTab('calendar')}>
          <span className="ico">📅</span>{t.navCalendar}
        </button>
        <button className={`tab ${tab === 'insights' ? 'active' : ''}`} onClick={() => setTab('insights')}>
          <span className="ico">📊</span>{t.navInsights}
        </button>
        <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          <span className="ico">🕘</span>{t.navHistory}
        </button>
        <button className={`tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>
          <span className="ico">⚙️</span>{t.navSettings}
        </button>
      </nav>
    </div>
  );
}
