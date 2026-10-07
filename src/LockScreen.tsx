import { useState } from 'react';
import { t } from './i18n';
import { checkPin } from './lock';

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

  // Fill tracks the submit threshold (4): whatever the PIN length, the bar
  // reads full the moment enough digits are in. Auto-submit fires at 4+, so
  // dividing by 8 left the bar half-empty forever.
  const fill = Math.min(pin.length / 4, 1);

  return (
    <div className="app">
      <div className="lock-wrap">
        <div className="lock-plain">
          <h2>{t.lockTitle}</h2>
          <div className="muted">{t.lockEnter}</div>
          <div className={`lock-bar${err ? ' lock-shake' : ''}`} role="status" aria-label={`${pin.length}/8`}>
            <div className="lock-bar-fill" aria-hidden="true" style={{ transform: `scaleX(${fill})` }} />
            <div className="lock-bar-digits" aria-hidden="true">
              {Array.from({ length: 8 }).map((_, i) => (
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
