import { useCallback, useEffect, useState } from 'react';
import Calendar, { type Period, type Prediction } from './Calendar';
import LogSheet from './LogSheet';
import BcPanel from './BcPanel';
import EcPanel from './EcPanel';

type Me = { periods: Period[]; bc: { pill_type: string; regimen: string } | null; ec: { ec_type: string; intake_at: string }[]; prediction: Prediction };

const today = () => new Date().toISOString().slice(0, 10);

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ym, setYm] = useState(() => { const t = new Date(); return { y: t.getFullYear(), m: t.getMonth() }; });
  const [sel, setSel] = useState<string | null>(null);
  const [bcOpen, setBcOpen] = useState(false);
  const [ecOpen, setEcOpen] = useState(false);
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: login.mode, email: login.email, password: login.password }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr((j as any).error ?? 'login failed'); return; }
      setLogin({ email: '', password: '', mode: 'login' });
      await load();
    } catch (e: any) { setErr(e.message); }
  };

  const doLogout = async () => {
    await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
    setMe(null);
    setNeedLogin(true);
  };
  const jumpToday = () => { const t = new Date(); setYm({ y: t.getFullYear(), m: t.getMonth() }); setSel(today()); };
  if (needLogin) {
    return (
      <div className="wrap">
        <h2 style={{ margin: '32px 0 4px' }}>Period Tracker</h2>
        <div className="muted" style={{ marginBottom: 16 }}>Log in or create an account</div>
        <form onSubmit={doAuth}>
          <input type="email" required placeholder="email" autoComplete="email"
            value={login.email} onChange={(e) => setLogin({ ...login, email: e.target.value })}
            style={{ width: '100%', padding: 10, marginBottom: 8, borderRadius: 8, border: '1px solid #ddd' }} />
          <input type="password" required minLength={8} placeholder="password (min 8)" autoComplete={login.mode === 'login' ? 'current-password' : 'new-password'}
            value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })}
            style={{ width: '100%', padding: 10, marginBottom: 12, borderRadius: 8, border: '1px solid #ddd' }} />
          {err && <div className="err" style={{ marginBottom: 8 }}>{err}</div>}
          <div className="row" style={{ marginTop: 0 }}>
            <button className="primary" type="submit">{login.mode === 'login' ? 'Log in' : 'Sign up'}</button>
            <button type="button" onClick={() => setLogin({ ...login, mode: login.mode === 'login' ? 'signup' : 'login' })}>
              {login.mode === 'login' ? 'Need account? Sign up' : 'Have account? Log in'}
            </button>
          </div>
        </form>
        <footer>General info only, not medical advice.</footer>
      </div>
    );
  }
  const label = new Date(Date.UTC(ym.y, ym.m, 1)).toLocaleString(undefined, { month: 'long', year: 'numeric' });
  const existing = sel ? me?.periods.find((p) => p.start_date === sel) : undefined;
  const flags = me?.prediction.flags ?? [];
  const bcMode = me?.prediction.confidence === 'suppressed' || flags.includes('bc-suppressed');
  const ecHit = flags.includes('ec-disrupted');
  const history = me ? [...me.periods].sort((a, b) => b.start_date.localeCompare(a.start_date)) : [];

  return (
    <div className="wrap">
      <div className="bar">
        <button onClick={() => setYm(v => ({ y: v.m === 0 ? v.y - 1 : v.y, m: (v.m + 11) % 12 }))}>‹</button>
        <strong>{label}</strong>
        <button onClick={() => setYm(v => ({ y: v.m === 11 ? v.y + 1 : v.y, m: (v.m + 1) % 12 }))}>›</button>
        <button onClick={jumpToday}>Today</button>
        <button onClick={doLogout}>Logout</button>
      </div>
      {err && <div className="err">{err}</div>}
      {bcMode && (
        <div role="alert" style={{ background: '#fff3cd', border: '1px solid #e6a817', borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 8 }}>
          BC-suppressed — on {me?.bc?.pill_type ?? 'birth control'} ({me?.bc?.regimen ?? 'active regimen'}), cycle predictions paused.
        </div>
      )}
      {ecHit && (
        <div role="alert" style={{ background: '#fff8e1', border: '1px solid #e6a817', borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 8 }}>
          EC may disrupt this cycle ({me?.ec?.[0]?.ec_type} {me?.ec?.[0]?.intake_at?.slice(0, 10) ?? ''}). Predictions unreliable — take a pregnancy test 21 days after unprotected sex or if period is 7+ days late.
        </div>
      )}
      {!me && !err && <div className="muted">loading…</div>}
      {me && (
        <>
          <Calendar year={ym.y} mon={ym.m} periods={me.periods} prediction={me.prediction} selected={sel} onPick={setSel} />
          <div className="muted" style={{ marginTop: 8 }}>
            {me.prediction.next ? `next ${me.prediction.next} (${me.prediction.lo}–${me.prediction.hi})` : 'not enough data — log 2+ periods'}
            {flags.includes('irregular') ? ' · irregular cycles, wide window' : ''}
          </div>
          <div className="row">
            <button onClick={() => setBcOpen(true)}>BC</button>
            <button onClick={() => setEcOpen(true)}>EC log</button>
          </div>
          <h3 style={{ margin: '16px 0 8px', fontSize: 14 }}>History</h3>
          {history.length === 0 && <div className="muted">nothing logged yet</div>}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {history.map((p) => (
              <li key={p.id} style={{ padding: '6px 0', borderBottom: '1px solid #eee', fontSize: 13 }}>
                <button onClick={() => setSel(p.start_date)} style={{ padding: '2px 8px', marginRight: 8 }}>{p.start_date}</button>
                {p.type}{p.flow ? ` · ${p.flow}` : ''}{p.end_date ? ` → ${p.end_date}` : ''}
              </li>
            ))}
          </ul>
        </>
      )}
      {sel && <LogSheet date={sel} existing={existing} onClose={() => setSel(null)} onSaved={setMe} />}
      {bcOpen && <BcPanel current={me?.bc ?? null} onClose={() => setBcOpen(false)} onSaved={setMe} />}
      {ecOpen && <EcPanel onClose={() => setEcOpen(false)} onSaved={setMe} />}
      <footer>
        General info only, not medical advice. Predictions are estimates, not contraception guidance.
        {ecHit ? ' After EC, talk to a pharmacist/clinician if unsure when to test.' : ''}
      </footer>
    </div>
  );
}
