// New hashes are self-describing (algorithm$iterations$digest) so the cost can
// be raised again later without a schema migration.
// 100000 is a hard platform ceiling, not a preference: workerd throws
// "NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not
// supported" for anything higher, which surfaced as a 500 on every login.
// Measured 2026-09-15 against the deployed worker (/api/_probe?n=...):
// 50000 ok, 100000 ok, 200000 and 600000 throw. OWASP's 600000 is unreachable
// on Pages Functions; 100000 is the strongest available here.
const PBKDF2_ITERATIONS = 100000;
// Pre-065fee3 hashes are a bare base64 digest derived at this cost.
const LEGACY_PBKDF2_ITERATIONS = 50000;

async function pbkdf2(pw: string, salt: string, iterations: number): Promise<string> {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations, hash: 'SHA-256' },
    km,
    256
  );
  const bytes = new Uint8Array(bits);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export async function hashPw(pw: string, salt: string): Promise<string> {
  return `pbkdf2-sha256$${PBKDF2_ITERATIONS}$${await pbkdf2(pw, salt, PBKDF2_ITERATIONS)}`;
}

// Constant-time string compare. `!==` exits at the first differing byte, which
// leaks how many leading bytes matched via timing. Length is compared first,
// which is unavoidable; hash digests are fixed-length so it reveals nothing.
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Accepts both the current self-describing format and the legacy bare-base64
// digest, so every pre-existing user can still log in. `legacy` lets the caller
// transparently re-hash to the current cost.
export async function verifyPw(pw: string, salt: string, stored: string): Promise<{ ok: boolean; legacy: boolean }> {
  if (stored.startsWith('pbkdf2-sha256$')) {
    const parts = stored.split('$');
    const iterations = Number(parts[1]);
    if (!Number.isInteger(iterations) || iterations <= 0) return { ok: false, legacy: false };
    const digest = await pbkdf2(pw, salt, iterations);
    return { ok: constantTimeEqual(digest, parts[2] ?? ''), legacy: false };
  }
  if (!stored) {
    // Unknown account: still derive, so an unknown email costs the same as a
    // wrong password and login timing does not enumerate accounts.
    await pbkdf2(pw, salt, PBKDF2_ITERATIONS);
    return { ok: false, legacy: false };
  }
  const digest = await pbkdf2(pw, salt, LEGACY_PBKDF2_ITERATIONS);
  return { ok: constantTimeEqual(digest, stored), legacy: true };
}

export function uid(): string {
  return crypto.randomUUID();
}

// 256 bits of CSPRNG entropy, base64url. Session tokens are bearer credentials;
// do not reuse uid() (a v4 UUID) for them.
export function sessionToken(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

import { predict, cycleStats, ecDisrupts } from './_predict';
import { insights } from './_insights';
import { clientDate } from './_today';

export function getCookie(request: Request, name: string): string | null {
  const h = request.headers.get('Cookie');
  if (!h) return null;
  for (const part of h.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export function sessCookie(token: string, delete_ = false): string {
  return delete_
    ? 'sess=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Secure'
    : `sess=${token}; HttpOnly; Path=/; Max-Age=2592000; SameSite=Lax; Secure`;
}

// Baseline security headers for Function responses (public/_headers covers the
// static assets). A JSON API needs no scripts, styles, images or frames.
export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
};

export function withSecurityHeaders(res: Response): Response {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) h.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

// ponytail: in-memory rate limit, per-worker only. D1/KV store if multi-isolate abuse matters.
const attempts = new Map<string, number[]>();
export function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (attempts.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  arr.push(now);
  attempts.set(ip, arr);
  return arr.length > 10;
}

export async function buildState(env: any, userId: string, request?: Request) {
  const { results: periods } = await env.DB.prepare(
    'SELECT id,start_date,end_date,flow,type FROM periods WHERE user_id=? ORDER BY start_date'
  ).bind(userId).all();
  const bc = await env.DB.prepare(
    'SELECT id,pill_type,regimen,pack_start_date FROM pill_regimens WHERE user_id=? ORDER BY pack_start_date DESC LIMIT 1'
  ).bind(userId).first();
  const ecCutoff = new Date(Date.now() - 60 * 864e5).toISOString();
  const { results: ec } = await env.DB.prepare(
    'SELECT id,ec_type,intake_at,upsi_at FROM ec_events WHERE user_id=? AND intake_at>? ORDER BY intake_at DESC'
  ).bind(userId, ecCutoff).all();
  const starts = (periods as any[]).filter((p) => p.type === 'menstruation').map((p) => p.start_date as string);
  const profile: any = await env.DB.prepare(
    'SELECT display_name, cycle_len, period_len FROM users WHERE id=?'
  ).bind(userId).first();
  // Feed the user's configured cycle length into the prediction as the fallback.
  const fallbackCycle = profile?.cycle_len ?? 28;
  // One stats object is shared by the prediction and the insights screen so the
  // two can never disagree on the observed cycle length.
  const stats = cycleStats(starts, fallbackCycle);
  const lastStart = starts.length ? starts[starts.length - 1] : null;
  // EC only disrupts while it is the plausible explanation for the current cycle:
  // stop once a period has been logged since the dose, or after two cycles.
  // Without this, a 59-day-old dose kept suppressing ovulation forever.
  const activeEc = (ec as any[]).find((e) => ecDisrupts(e.intake_at, lastStart, stats.avg)) ?? null;
  const prediction = predict(starts, { ecType: activeEc?.ec_type ?? null, bcMode: !!bc, fallbackCycle }, stats);
  const todayIso = request ? clientDate(request) : new Date().toISOString().slice(0, 10);
  const { results: symptoms } = await env.DB.prepare(
    'SELECT kind FROM symptoms WHERE user_id=? AND date=?'
  ).bind(userId, todayIso).all();
  const ins = insights(periods as any[], fallbackCycle, profile?.period_len ?? 5, stats);
  return {
    periods, bc: bc ?? null, ec, prediction,
    todaySymptoms: (symptoms as any[]).map((s) => s.kind),
    today: todayIso,
    profile: profile ?? null,
    insights: ins,
  };
}

export async function requireUser(env: any, request: Request): Promise<{ id: string; email: string } | null> {
  const token = getCookie(request, 'sess');
  if (!token) return null;
  const sess = await env.DB.prepare('SELECT user_id, expires_at FROM sessions WHERE token=?').bind(token).first();
  if (!sess || Date.parse(sess.expires_at as string) < Date.now()) return null;
  const user = await env.DB.prepare('SELECT id, email FROM users WHERE id=?').bind(sess.user_id).first();
  return user as any;
}
