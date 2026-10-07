import { useState } from 'react';
import { t } from './i18n';
import { checkPin, lockLen } from './lock';

// Full-screen gate shown before any content when the app lock is on. Numeric
// pad, not a text field: no keyboard-layout surprise, no autocomplete, no
// password-manager prompt fighting for the same input.
//
// No card: a rounded progress bar up top shows masked digits and fills rose
// as they land; the circular keys sit bare below it.
export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  // The gate knows the PIN length from setup, so submit fires exactly when
  // the last digit lands — 4, 6, 8, whatever was chosen. Legacy locks
  // (pre-length) fall back to 4.
  const need = lockLen();

  async function submit(code: string) {
    if (code.length < need || busy) return;
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
    if (next.length >= need) void submit(next);
  }

  // Fill tracks the known length: full the moment enough digits are in.
  const fill = Math.min(pin.length / need, 1);

  return (
    <div className="app">
      <div className="lock-wrap">
        <div className="lock-plain">
          <h2>{t.lockTitle}</h2>
          <div className="muted">{t.lockEnter}</div>
          <div className={`lock-bar${err ? ' lock-shake' : ''}`} role="status" aria-label={`${pin.length}/${need}`}>
            <div className="lock-bar-fill" aria-hidden="true" style={{ transform: `scaleX(${fill})` }} />
            <div className="lock-bar-digits" aria-hidden="true">
              {Array.from({ length: need }).map((_, i) => (
                <span key={i}>{i < pin.length ? '•' : '–'}</span>
              ))}
            </div>
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
  );
}
