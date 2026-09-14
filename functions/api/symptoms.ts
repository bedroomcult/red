import { requireUser, uid } from '../_lib';

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

const isDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

const KINDS = ['cramps', 'bloating', 'headache', 'mood', 'tired', 'breast', 'acne', 'craving'];

export async function onRequestGet({ request, env }: any) {
  const user = await requireUser(env, request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const date = new URL(request.url).searchParams.get('date');
  const stmt = date
    ? env.DB.prepare('SELECT id,date,kind FROM symptoms WHERE user_id=? AND date=?').bind(user.id, date)
    : env.DB.prepare('SELECT id,date,kind FROM symptoms WHERE user_id=? ORDER BY date DESC LIMIT 400').bind(user.id);
  const { results } = await stmt.all();
  return json({ symptoms: results });
}

export async function onRequestPost({ request, env }: any) {
  const user = await requireUser(env, request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  let b: any;
  try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  if (!isDate(b?.date)) return json({ error: 'date YYYY-MM-DD required' }, 400);
  if (!KINDS.includes(b?.kind)) return json({ error: 'unknown symptom kind' }, 400);
  // Toggle: same (user,date,kind) removes it.
  const ex = await env.DB.prepare('SELECT id FROM symptoms WHERE user_id=? AND date=? AND kind=?').bind(user.id, b.date, b.kind).first();
  if (ex) await env.DB.prepare('DELETE FROM symptoms WHERE id=?').bind(ex.id).run();
  else await env.DB.prepare('INSERT INTO symptoms (id,user_id,date,kind) VALUES (?,?,?,?)').bind(uid(), user.id, b.date, b.kind).run();
  const { results } = await env.DB.prepare('SELECT id,date,kind FROM symptoms WHERE user_id=? AND date=?').bind(user.id, b.date).all();
  return json({ symptoms: results });
}
