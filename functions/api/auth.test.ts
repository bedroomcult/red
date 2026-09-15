import { describe, it, expect, beforeEach } from 'vitest';
import { onRequestPost } from './auth';
import { makeDb } from '../../test/d1-shim';

// Pre-065fee3 hashes: bare base64 digest at 50k iterations.
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

let db: ReturnType<typeof makeDb>;
let env: any;
let seq = 0;
// Fresh ip per request so the module-level rate limiter cannot leak between
// tests. Tests that exercise the limiter pass a fixed ip explicitly.
const freshIp = () => `test-ip-${++seq}`;

const post = (body: unknown, ipAddr = freshIp()) =>
  new Request('https://example.com/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ipAddr },
    body: JSON.stringify(body),
  });

const postRaw = (text: string, ipAddr = freshIp()) =>
  new Request('https://example.com/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ipAddr },
    body: text,
  });

const get = (body: unknown, cookie: string) =>
  new Request('https://example.com/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': freshIp(), Cookie: cookie },
    body: JSON.stringify(body),
  });

const tokenOf = (res: Response) => {
  const sc = res.headers.get('Set-Cookie') ?? '';
  const m = sc.match(/sess=([^;]+)/);
  return m ? m[1] : '';
};

beforeEach(() => {
  db = makeDb();
  env = { DB: db };
});

describe('POST /api/auth', () => {
  it('signs up a new user and sets a session cookie', async () => {
    const res = await onRequestPost({ request: post({ action: 'signup', email: 'a@b.com', password: 'password1' }), env });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(tokenOf(res).length).toBeGreaterThan(0);
    expect(db.users.length).toBe(1);
    expect(db.users[0].email).toBe('a@b.com');
  });

  it('rejects a duplicate email with 409', async () => {
    const ok = await onRequestPost({ request: post({ action: 'signup', email: 'a@b.com', password: 'password1' }), env });
    expect(ok.status).toBe(200);
    const dup = await onRequestPost({ request: post({ action: 'signup', email: 'a@b.com', password: 'password2' }), env });
    expect(dup.status).toBe(409);
    expect(await dup.json()).toEqual({ error: 'email taken' });
  });

  it('rejects a password shorter than 8 chars without creating a user', async () => {
    const res = await onRequestPost({ request: post({ action: 'signup', email: 'a@b.com', password: 'short' }), env });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'password min 8 chars' });
    expect(db.users.length).toBe(0);
  });

  it('requires both email and password', async () => {
    const res = await onRequestPost({ request: post({ action: 'signup', email: 'a@b.com' }), env });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'email+password required' });
  });

  it('rejects a malformed JSON body', async () => {
    const res = await onRequestPost({ request: postRaw('{not json'), env });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'bad json' });
  });

  it('logs in with correct credentials', async () => {
    await onRequestPost({ request: post({ action: 'signup', email: 'a@b.com', password: 'password1' }), env });
    const res = await onRequestPost({ request: post({ action: 'login', email: 'a@b.com', password: 'password1' }), env });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(tokenOf(res).length).toBeGreaterThan(0);
  });

  it('rejects a wrong password and an unknown email identically', async () => {
    await onRequestPost({ request: post({ action: 'signup', email: 'a@b.com', password: 'password1' }), env });
    const wrongPw = await onRequestPost({ request: post({ action: 'login', email: 'a@b.com', password: 'password2' }), env });
    const unknown = await onRequestPost({ request: post({ action: 'login', email: 'nobody@b.com', password: 'password1' }), env });
    expect(wrongPw.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await wrongPw.json()).toEqual({ error: 'invalid login' });
    expect(await unknown.json()).toEqual({ error: 'invalid login' });
  });

  it('treats the email case-insensitively on login', async () => {
    await onRequestPost({ request: post({ action: 'signup', email: 'A@B.com', password: 'password1' }), env });
    const res = await onRequestPost({ request: post({ action: 'login', email: 'a@b.com', password: 'password1' }), env });
    expect(res.status).toBe(200);
    expect(db.users[0].email).toBe('a@b.com');
  });

  it('trims and lowercases the email on signup', async () => {
    await onRequestPost({ request: post({ action: 'signup', email: '  A@B.com  ', password: 'password1' }), env });
    expect(db.users[0].email).toBe('a@b.com');
  });

  it('logs in an existing user whose hash predates the format change', async () => {
    const salt = 'legacy-salt';
    db.users.push({
      id: 'legacy-user',
      email: 'old@b.com',
      pass_hash: await legacyHash('password1', salt),
      salt,
      created_at: new Date().toISOString(),
    });
    const res = await onRequestPost({ request: post({ action: 'login', email: 'old@b.com', password: 'password1' }), env });
    expect(res.status).toBe(200);
    // Transparently upgraded to the current cost on successful login.
    expect(db.users[0].pass_hash.startsWith('pbkdf2-sha256$')).toBe(true);
  });

  it('does not upgrade the hash on a failed legacy login', async () => {
    const salt = 'legacy-salt';
    const legacy = await legacyHash('password1', salt);
    db.users.push({ id: 'legacy-user', email: 'old@b.com', pass_hash: legacy, salt, created_at: new Date().toISOString() });
    const res = await onRequestPost({ request: post({ action: 'login', email: 'old@b.com', password: 'password2' }), env });
    expect(res.status).toBe(401);
    expect(db.users[0].pass_hash).toBe(legacy);
  });

  it('sets security headers on every response', async () => {
    const res = await onRequestPost({ request: post({ action: 'login', email: 'a@b.com', password: 'password1' }), env });
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('logs out and removes the session', async () => {
    const up = await onRequestPost({ request: post({ action: 'signup', email: 'a@b.com', password: 'password1' }), env });
    const token = tokenOf(up);
    expect(db.sessions.length).toBe(1);
    const res = await onRequestPost({ request: get({ action: 'logout' }, `sess=${token}`), env });
    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie') ?? '').toContain('Max-Age=0');
    expect(db.sessions.length).toBe(0);
  });

  it('rejects an unknown action', async () => {
    const res = await onRequestPost({ request: post({ action: 'nonsense', email: 'a@b.com', password: 'password1' }), env });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'unknown action' });
  });

  it('rate-limits the 11th attempt from one ip', async () => {
    const ip = 'rate-limit-ip';
    for (let i = 0; i < 10; i++) {
      const r = await onRequestPost({ request: post({ action: 'login', email: 'a@b.com', password: 'password1' }, ip), env });
      expect(r.status).toBe(401);
    }
    const blocked = await onRequestPost({ request: post({ action: 'login', email: 'a@b.com', password: 'password1' }, ip), env });
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toEqual({ error: 'too many attempts' });
  });
});
