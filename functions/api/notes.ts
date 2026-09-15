import { requireUser, jsonResponse } from '../_lib';

const json = jsonResponse;

const isDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function onRequestGet({ request, env }: any) {
  const user = await requireUser(env, request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const date = new URL(request.url).searchParams.get('date');
  if (!isDate(date)) return json({ error: 'date required' }, 400);
  const row: any = await env.DB.prepare('SELECT note FROM day_notes WHERE user_id=? AND date=?').bind(user.id, date).first();
  return json({ note: row?.note ?? '' });
}

export async function onRequestPost({ request, env }: any) {
  const user = await requireUser(env, request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  let b: any;
  try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  if (!isDate(b?.date)) return json({ error: 'date required' }, 400);
  const note = typeof b?.note === 'string' ? b.note.slice(0, 1000) : '';
  if (!note) await env.DB.prepare('DELETE FROM day_notes WHERE user_id=? AND date=?').bind(user.id, b.date).run();
  else await env.DB.prepare('INSERT INTO day_notes (user_id,date,note) VALUES (?,?,?) ON CONFLICT(user_id,date) DO UPDATE SET note=excluded.note').bind(user.id, b.date, note).run();
  return json({ ok: true, note });
}
