import { useState } from 'react';
import { t } from './i18n';

// 3-step first-run flow: name -> last period -> cycle length.
export default function Onboarding({ onDone }: { onDone: (s: any) => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [last, setLast] = useState(() => new Date().toISOString().slice(0, 10));
  const [cycle, setCycle] = useState(28);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function finish() {
    setBusy(true); setErr(null);
    try {
      const pr = await fetch('/api/profile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: name || undefined, cycle_len: cycle, period_len: 5 }),
      });
      if (!pr.ok) throw new Error((await pr.json()).error ?? pr.statusText);
      if (last) {
        const pe = await fetch('/api/periods', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ start_date: last, type: 'menstruation', flow: 'medium' }),
        });
        if (!pe.ok) throw new Error((await pe.json()).error ?? pe.statusText);
        onDone(await pe.json());
      } else {
        onDone(await pr.json());
      }
    } catch (e: any) { setErr(e.message); setBusy(false); }
  }

  const steps = [
    { title: t.obWelcomeTitle, sub: t.obWelcomeSub },
    { title: t.obNameTitle, sub: t.obNameSub },
    { title: t.obLastTitle, sub: t.obLastSub },
    { title: t.obCycleTitle, sub: t.obCycleSub },
  ];
  const s = steps[step];
  const lastStep = step === steps.length - 1;

  return (
    <div className="app auth" style={{ paddingTop: 60 }}>
      <div key={step} className="pop">
        <div style={{ fontSize: 40, marginBottom: 16 }}>{['🌸', '👋', '📅', '🔄'][step]}</div>
        <h1>{s.title}</h1>
        <div className="sub">{s.sub}</div>

        {step === 1 && (
          <div className="field">
            <input value={name} maxLength={40} placeholder={t.obNameTitle}
              onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
        )}
        {step === 2 && (
          <div className="field">
            <input type="date" value={last} max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setLast(e.target.value)} />
          </div>
        )}
        {step === 3 && (
          <div className="field">
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <input type="range" min={15} max={60} value={cycle}
                onChange={(e) => setCycle(Number(e.target.value))} style={{ flex: 1, padding: 0 }} />
              <strong style={{ fontSize: 22, minWidth: 52, textAlign: 'right' }}>{cycle}</strong>
            </div>
          </div>
        )}

        {err && <div className="err">{err}</div>}

        <div className="row">
          <button className="btn primary" style={{ flex: 1 }} disabled={busy}
            onClick={() => (lastStep ? finish() : setStep(step + 1))}>
            {lastStep ? t.obDone : t.obNext}
          </button>
        </div>
        <div className="row tight">
          {step > 0 && <button className="btn ghost" disabled={busy} onClick={() => setStep(step - 1)}>{t.obBack}</button>}
          <button className="btn ghost" disabled={busy} onClick={finish}>{t.obSkip}</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 24 }}>
        {steps.map((_, i) => (
          <span key={i} style={{
            width: i === step ? 20 : 6, height: 6, borderRadius: 3,
            background: i === step ? 'var(--rose)' : 'var(--line)',
            transition: 'width .25s ease, background .25s ease',
          }} />
        ))}
      </div>
    </div>
  );
}
