import { useCallback, useEffect, useState } from 'react';
import Calendar, { type Period, type Prediction } from './Calendar';
import LogSheet from './LogSheet';

type Me = { periods: Period[]; bc: { pill_type: string; regimen: string } | null; ec: { ec_type: string; intake_at: string }[]; prediction: Prediction };

const today = () => new Date().toISOString().slice(0, 10);

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ym, setYm] = useState(() => { const t = new Date(); return { y: t.getFullYear(), m: t.getMonth() }; });
  const [sel, setSel] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/me');
      if (r.status === 401) { setErr('login required'); return; }
      if (!r.ok) throw new Error(r.statusText);
      setMe(await r.json());
    } catch (e: any) { setErr(e.message); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const jumpToday = () => { const t = new Date(); setYm({ y: t.getFullYear(), m: t.getMonth() }); setSel(today()); };
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
      <footer>
        General info only, not medical advice. Predictions are estimates, not contraception guidance.
        {ecHit ? ' After EC, talk to a pharmacist/clinician if unsure when to test.' : ''}
      </footer>
    </div>
  );
}
