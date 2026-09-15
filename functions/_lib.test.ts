import { describe, it, expect } from 'vitest';
import { hashPw, verifyPw, constantTimeEqual, getCookie, sessCookie, rateLimited } from './_lib';
import { clientDate } from './_today';

// Reproduce the pre-065fee3 hash (bare base64, 50k iterations) to prove existing
// users can still log in after the format change.
async function legacyHash(pw: string, salt: string): Promise<string> {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 50000, hash: 'SHA-256' },
    km,
    256
  );
  const bytes = new Uint8Array(bits);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

describe('hashPw', () => {
  it('emits a self-describing pbkdf2-sha256 hash at 100000 iterations', async () => {
    const h = await hashPw('password123', 'salt-a');
    expect(h).toMatch(/^pbkdf2-sha256\$100000\$[A-Za-z0-9+/=]+$/);
  });

  it('is deterministic for the same password and salt', async () => {
    const a = await hashPw('password123', 'salt-a');
    const b = await hashPw('password123', 'salt-a');
    expect(a).toBe(b);
  });

  it('differs for different salts and for different passwords', async () => {
    const a = await hashPw('password123', 'salt-a');
    const b = await hashPw('password123', 'salt-b');
    const c = await hashPw('password124', 'salt-a');
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });
});

describe('verifyPw', () => {
  it('accepts the current format and reports it as non-legacy', async () => {
    const stored = await hashPw('password123', 'salt-a');
    expect(await verifyPw('password123', 'salt-a', stored)).toEqual({ ok: true, legacy: false });
  });

  it('rejects a wrong password', async () => {
    const stored = await hashPw('password123', 'salt-a');
    expect(await verifyPw('wrong', 'salt-a', stored)).toEqual({ ok: false, legacy: false });
  });

  // Critical: a bug here locks out every user who signed up before the format change.
  it('still accepts a legacy 50k-iteration bare-base64 hash, flagged as legacy', async () => {
    const stored = await legacyHash('password123', 'salt-a');
    expect(await verifyPw('password123', 'salt-a', stored)).toEqual({ ok: true, legacy: true });
    expect(await verifyPw('wrong', 'salt-a', stored)).toEqual({ ok: false, legacy: true });
  });

  it('returns ok:false without throwing on a malformed stored value', async () => {
    expect(await verifyPw('password123', 'salt-a', 'pbkdf2-sha256$abc$xxx')).toEqual({ ok: false, legacy: false });
    expect(await verifyPw('password123', 'salt-a', 'pbkdf2-sha256$0$xxx')).toEqual({ ok: false, legacy: false });
  });

  it('returns ok:false for an unknown account (empty stored value)', async () => {
    expect(await verifyPw('password123', 'salt-a', '')).toEqual({ ok: false, legacy: false });
  });
});

describe('constantTimeEqual', () => {
  it('compares equal and differing strings', () => {
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'ab')).toBe(false);
    expect(constantTimeEqual('', '')).toBe(true);
  });
});

describe('getCookie', () => {
  const req = (cookie?: string) =>
    new Request('https://example.com/', cookie ? { headers: { Cookie: cookie } } : undefined);

  it('returns the value of the named cookie', () => {
    expect(getCookie(req('a=1; sess=abc'), 'sess')).toBe('abc');
  });

  it('returns null when the header is absent', () => {
    expect(getCookie(req(), 'sess')).toBe(null);
  });

  it('returns null when the name is absent from the header', () => {
    expect(getCookie(req('a=1; other=x'), 'sess')).toBe(null);
  });
});

describe('sessCookie', () => {
  it('sets an HttpOnly, SameSite=Lax, Secure session cookie', () => {
    const c = sessCookie('tok');
    expect(c.startsWith('sess=tok')).toBe(true);
    expect(c).toContain('HttpOnly');
    expect(c).toContain('SameSite=Lax');
    expect(c).toContain('Secure');
  });

  it('clears the cookie with Max-Age=0', () => {
    expect(sessCookie('', true)).toContain('Max-Age=0');
  });
});

describe('rateLimited', () => {
  it('allows 10 attempts then blocks the 11th for the same ip', () => {
    const ip = 'fixed-test-ip';
    for (let i = 0; i < 10; i++) expect(rateLimited(ip)).toBe(false);
    expect(rateLimited(ip)).toBe(true);
  });

  it('tracks each ip independently', () => {
    expect(rateLimited('other-test-ip-a')).toBe(false);
    expect(rateLimited('other-test-ip-b')).toBe(false);
  });
});

describe('clientDate', () => {
  const req = (headers?: Record<string, string>) =>
    new Request('https://example.com/api/me', headers ? { headers } : undefined);

  it('uses the validated X-Local-Date header', () => {
    expect(clientDate(req({ 'X-Local-Date': '2026-01-15' }))).toBe('2026-01-15');
  });

  it('falls back to UTC when the header is absent or malformed', () => {
    const utcToday = new Date().toISOString().slice(0, 10);
    expect(clientDate(req())).toBe(utcToday);
    expect(clientDate(req({ 'X-Local-Date': '2026-02-31' }))).toBe(utcToday);
    expect(clientDate(req({ 'X-Local-Date': 'garbage' }))).toBe(utcToday);
  });
});

// buildState is the single read path for Home, Calendar, Wawasan and Settings.
// The EC decay rule lives here, so it is tested here rather than through a UI.
import { buildState } from './_lib';
import { makeDb } from '../test/d1-shim';

const USER = 'user-1';
const agoIso = (d: number) => new Date(Date.now() - d * 864e5).toISOString();
const agoDate = (d: number) => agoIso(d).slice(0, 10);

function env() {
  const db = makeDb();
  db.users.push({
    id: USER,
    email: 'a@b.com',
    pass_hash: 'x',
    salt: 's',
    created_at: agoIso(100),
    display_name: null,
    cycle_len: 28,
    period_len: 5,
  });
  return { DB: db, db };
}

describe('buildState', () => {
  it('returns a prediction and no EC disruption with no EC event', async () => {
    const { DB } = env();
    DB.periods.push({ id: 'p1', user_id: USER, start_date: '2026-01-01', end_date: '2026-01-05', flow: 'medium', type: 'menstruation' });
    const s = await buildState({ DB }, USER);
    expect(s.prediction.flags).not.toContain('ec-disrupted');
    expect(s.prediction.ov).not.toBeNull();
  });

  it('disrupts a recent EC dose: widened window and no ovulation', async () => {
    const { DB } = env();
    DB.periods.push({ id: 'p1', user_id: USER, start_date: '2026-01-01', end_date: '2026-01-05', flow: 'medium', type: 'menstruation' });
    DB.ec.push({ id: 'e1', user_id: USER, ec_type: 'LNG', intake_at: agoIso(3), upsi_at: null });
    const s = await buildState({ DB }, USER);
    expect(s.prediction.flags).toContain('ec-disrupted');
    expect(s.prediction.ov).toBeNull();
  });

  it('expires EC disruption after two cycles with no period logged since', async () => {
    const { DB } = env();
    // Last period long before the dose, dose 60 days old (> 2 x 28d window).
    DB.periods.push({ id: 'p1', user_id: USER, start_date: agoDate(90), end_date: null, flow: 'medium', type: 'menstruation' });
    DB.ec.push({ id: 'e1', user_id: USER, ec_type: 'LNG', intake_at: agoIso(60), upsi_at: null });
    const s = await buildState({ DB }, USER);
    expect(s.prediction.flags).not.toContain('ec-disrupted');
    expect(s.prediction.ov).not.toBeNull();
  });

  it('expires EC disruption once a period is logged after the dose', async () => {
    const { DB } = env();
    DB.periods.push({ id: 'p1', user_id: USER, start_date: agoDate(1), end_date: null, flow: 'medium', type: 'menstruation' });
    DB.ec.push({ id: 'e1', user_id: USER, ec_type: 'LNG', intake_at: agoIso(3), upsi_at: null });
    const s = await buildState({ DB }, USER);
    expect(s.prediction.flags).not.toContain('ec-disrupted');
  });

  it('ignores EC events older than the 60-day query cutoff', async () => {
    const { DB } = env();
    DB.periods.push({ id: 'p1', user_id: USER, start_date: '2026-01-01', end_date: null, flow: 'medium', type: 'menstruation' });
    DB.ec.push({ id: 'e1', user_id: USER, ec_type: 'UPA', intake_at: agoIso(90), upsi_at: null });
    const s = await buildState({ DB }, USER);
    expect(s.ec).toEqual([]);
    expect(s.prediction.flags).not.toContain('ec-disrupted');
  });

  it('suppresses the prediction entirely while on birth control', async () => {
    const { DB } = env();
    DB.periods.push({ id: 'p1', user_id: USER, start_date: '2026-01-01', end_date: null, flow: 'medium', type: 'menstruation' });
    DB.regimens.push({ id: 'r1', user_id: USER, pill_type: 'combined', regimen: '21/7', pack_start_date: '2026-01-01' });
    const s = await buildState({ DB }, USER);
    expect(s.prediction.confidence).toBe('suppressed');
    expect(s.prediction.next).toBeNull();
  });

  it('agrees between the prediction and the insights screen', async () => {
    const { DB } = env();
    DB.periods.push(
      { id: 'p1', user_id: USER, start_date: '2026-01-01', end_date: '2026-01-05', flow: 'medium', type: 'menstruation' },
      { id: 'p2', user_id: USER, start_date: '2026-01-29', end_date: '2026-02-02', flow: 'medium', type: 'menstruation' },
      { id: 'p3', user_id: USER, start_date: '2026-02-26', end_date: '2026-03-02', flow: 'medium', type: 'menstruation' }
    );
    const s = await buildState({ DB }, USER);
    expect(s.insights.avgCycle).toBe(28);
    expect(s.insights.next3[0]).toBe(s.prediction.next);
    expect(s.insights.next3[0]).toBe('2026-03-26');
  });

  it('uses the client date header for today and today symptoms', async () => {
    const { DB } = env();
    DB.symptoms.push({ user_id: USER, date: '2026-01-15', kind: 'cramps' });
    const req = new Request('https://example.com/api/me', { headers: { 'X-Local-Date': '2026-01-15' } });
    const s = await buildState({ DB }, USER, req);
    expect(s.today).toBe('2026-01-15');
    expect(s.todaySymptoms).toEqual(['cramps']);
  });

  it('falls back to UTC when the client date header is malformed', async () => {
    const { DB } = env();
    const req = new Request('https://example.com/api/me', { headers: { 'X-Local-Date': '2026-02-31' } });
    const s = await buildState({ DB }, USER, req);
    expect(s.today).toBe(new Date().toISOString().slice(0, 10));
  });
});
