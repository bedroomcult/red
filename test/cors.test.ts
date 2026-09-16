import { describe, it, expect } from 'vitest';
import { onRequest } from '../functions/api/_middleware';
import { SECURITY_HEADERS } from '../functions/_lib';

// The Android APK serves the bundle from https://localhost, so every /api/* call
// is cross-origin. Without these headers the WebView blocks the request and the
// session cookie is withheld, which surfaced as JSON parse errors in the app.
const APP_ORIGIN = 'https://localhost';

function ctx(method: string, origin?: string) {
  const req = new Request('https://api.example.com/api/me', {
    method,
    headers: origin ? { Origin: origin } : undefined,
  });
  return { request: req, next: () => Promise.resolve(new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })) };
}

describe('api CORS middleware', () => {
  it('answers the preflight with 204 and no body', async () => {
    const res = await onRequest(ctx('OPTIONS', APP_ORIGIN));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
  });

  it('allows the Capacitor app origin with credentials', async () => {
    const res = await onRequest(ctx('OPTIONS', APP_ORIGIN));
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(APP_ORIGIN);
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
  });

  it('allows the X-Local-Date and Content-Type request headers', async () => {
    const res = await onRequest(ctx('OPTIONS', APP_ORIGIN));
    const allowed = res.headers.get('Access-Control-Allow-Headers') ?? '';
    expect(allowed).toContain('X-Local-Date');
    expect(allowed).toContain('Content-Type');
  });

  it('does not allow an arbitrary origin', async () => {
    const res = await onRequest(ctx('OPTIONS', 'https://evil.example'));
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('never answers with a wildcard origin', async () => {
    const res = await onRequest(ctx('GET', APP_ORIGIN));
    expect(res.headers.get('Access-Control-Allow-Origin')).not.toBe('*');
  });

  it('adds the CORS headers to the actual response, not just the preflight', async () => {
    const res = await onRequest(ctx('GET', APP_ORIGIN));
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(APP_ORIGIN);
    expect(res.headers.get('Vary')).toBe('Origin');
  });

  it('keeps the security headers on the preflight response', async () => {
    const res = await onRequest(ctx('OPTIONS', APP_ORIGIN));
    expect(res.headers.get('X-Content-Type-Options')).toBe(SECURITY_HEADERS['X-Content-Type-Options']);
  });

  it('omits CORS headers when there is no Origin', async () => {
    const res = await onRequest(ctx('GET'));
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});
