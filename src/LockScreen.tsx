import { useState } from 'react';
import { t } from './i18n';
import { checkPin } from './lock';

// Full-screen gate shown before any content when the app lock is on. Numeric
// pad, not a text field: no keyboard-layout surprise, no autocomplete, no
// password-manager prompt fighting for the same input.
//
// Progress-fill card: the card background fills rose as digits land, full =
// submit. Playful and the progress needs no counting.
export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(code: string) {
    if (code.length < 4 || busy) return;
    setBusy(true);
    try {
      if (await checkPin(code)) { onUnlock(); }
      else { setErr(true); setPin(''); }
    } finally { setBusy(false); }
  }

  function press(d: string) {
    setErr(false);
    const next = (pin + d).slice(0, 8);
    setPin(next);
    if (next.length >= 4) void submit(next);
  }

  // Fill tracks the longest PIN (8): 4 digits = half full, 8 = full.
  const fill = Math.min(pin.length / 8, 1);

  return (
    <div className="app">
      <div className="lock-wrap">
        <div className={`card lock-card${err ? ' lock-shake' : ''}`} style={{ textAlign: 'center', width: '100%' }}>
          <div className="lock-fill" aria-hidden="true" style={{ transform: `scaleX(${fill})` }} />
          <div className="lock-inner">
            <h2>{t.lockTitle}</h2>
            <div className="muted">{t.lockEnter}</div>
            <div className="lock-dots" aria-hidden="true">
              {Array.from({ length: Math.max(pin.length, 4) }).map((_, i) => (
                <span key={i} className={`lock-dot${i < pin.length ? ' on' : ''}`} />
              ))}
            </div>
            {err && <div className="err">{t.lockWrong}</div>}
            <div className="lock-pad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) => (
                <button key={i} className="btn lock-key" disabled={busy || k === ''}
                  onClick={() => (k === '⌫' ? (setErr(false), setPin(pin.slice(0, -1))) : press(k))}>
                  {k}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
