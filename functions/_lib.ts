export async function hashPw(pw: string, salt: string): Promise<string> {
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

export function uid(): string {
  return crypto.randomUUID();
}

import { predict } from './_predict';
import { insights } from './_insights';

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

// ponytail: in-memory rate limit, per-worker only. D1/KV store if multi-isolate abuse matters.
const attempts = new Map<string, number[]>();
export function rateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (attempts.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  arr.push(now);
  attempts.set(ip, arr);
  return arr.length > 10;
}

export async function buildState(env: any, userId: string) {
  const { results: periods } = await env.DB.prepare(
    'SELECT id,start_date,end_date,flow,type FROM periods WHERE user_id=? ORDER BY start_date'
  ).bind(userId).all();
  const bc = await env.DB.prepare(
    'SELECT id,pill_type,regimen,pack_start_date FROM pill_regimens WHERE user_id=? ORDER BY pack_start_date DESC LIMIT 1'
  ).bind(userId).first();
  const cutoff = new Date(Date.now() - 60 * 864e5).toISOString();
  const { results: ec } = await env.DB.prepare(
    'SELECT id,ec_type,intake_at,upsi_at FROM ec_events WHERE user_id=? AND intake_at>? ORDER BY intake_at DESC'
  ).bind(userId, cutoff).all();
  const starts = (periods as any[]).filter((p) => p.type === 'menstruation').map((p) => p.start_date as string);
  const ecType = (ec as any[]).length ? (ec as any[])[0].ec_type : null;
  const prediction = predict(starts, { ecType, bcMode: !!bc });
  const todayIso = new Date().toISOString().slice(0, 10);
  const { results: symptoms } = await env.DB.prepare(
    'SELECT kind FROM symptoms WHERE user_id=? AND date=?'
  ).bind(userId, todayIso).all();
  const profile: any = await env.DB.prepare(
    'SELECT display_name, cycle_len, period_len FROM users WHERE id=?'
  ).bind(userId).first();
  const ins = insights(periods as any[], profile?.cycle_len ?? 28, profile?.period_len ?? 5);
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
