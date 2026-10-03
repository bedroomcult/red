// App lock: optional PIN gate before content renders. Local-only by design:
// a server-side lock would need the PIN (or its hash) to leave the device,
// and a lock the account owner cannot reset without verification is a
// lockout vector, not a feature.
//
// Two keys:
//   pt.lockPin  — SHA-256 hex of the PIN, set when the lock is enabled.
//   pt.lockOn   — '1' when the lock is active. Deleting both keys (via the
//                 reset control, or clearing app data) removes the lock with
//                 no verification step. Documented in Settings, not hidden.
//
// PIN rules: 4-8 digits. Short enough to type one-handed, long enough that a
// shoulder-surfed prefix is useless. No letters: the pad is numeric-only so
// there is no keyboard-layout surprise on device.
const PIN_KEY = 'pt.lockPin';
const ON_KEY = 'pt.lockOn';

export const isLockOn = (): boolean => {
  try {
    return localStorage.getItem(ON_KEY) === '1' && !!localStorage.getItem(PIN_KEY);
  } catch { return false; }
};

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('red-lock:' + s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const validPin = (pin: string): boolean => /^[0-9]{4,8}$/.test(pin);

export async function setLock(pin: string): Promise<boolean> {
  if (!validPin(pin)) return false;
  try {
    localStorage.setItem(PIN_KEY, await sha256Hex(pin));
    localStorage.setItem(ON_KEY, '1');
    return true;
  } catch { return false; }
}

export async function checkPin(pin: string): Promise<boolean> {
  try {
    const saved = localStorage.getItem(PIN_KEY);
    return !!saved && (await sha256Hex(pin)) === saved;
  } catch { return false; }
}

// No verification by design: the threat model is a nosy person holding the
// unlocked phone, not a thief. The account password (server-side) is the real
// recovery path, and it lives behind email verification.
export function resetLock(): void {
  try {
    localStorage.removeItem(PIN_KEY);
    localStorage.removeItem(ON_KEY);
  } catch {}
}
