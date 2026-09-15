import { describe, it, expect } from 'vitest';
import { hashPw, getCookie, sessCookie, rateLimited } from './_lib';
import { clientDate } from './_today';

describe('hashPw', () => {
  it('is deterministic for the same password and salt', async () => {
    const a = await hashPw('password123', 'salt-a');
    const b = await hashPw('password123', 'salt-a');
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
    expect(/^[A-Za-z0-9+/]+=*$/.test(a)).toBe(true);
  });

  it('differs for different salts and for different passwords', async () => {
    const a = await hashPw('password123', 'salt-a');
    const b = await hashPw('password123', 'salt-b');
    const c = await hashPw('password124', 'salt-a');
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
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
