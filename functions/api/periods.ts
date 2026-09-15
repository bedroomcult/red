import { requireUser, buildState, uid } from '../_lib';

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

const isDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));

export async function onRequestGet({ request, env }: any) {
  const user = await requireUser(env, request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const { results } = await env.DB.prepare(
    'SELECT id,start_date,end_date,flow,type FROM periods WHERE user_id=? ORDER BY start_date'
  ).bind(user.id).all();
  return json({ periods: results });
}

export async function onRequestPost({ request, env }: any) {
  const user = await requireUser(env, request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  let b: any;
  try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  if (!isDate(b?.start_date)) return json({ error: 'start_date YYYY-MM-DD required' }, 400);
  if (b.end_date && !isDate(b.end_date)) return json({ error: 'end_date YYYY-MM-DD' }, 400);
  const type = b.type ?? 'menstruation';
  if (!['menstruation', 'spotting'].includes(type)) return json({ error: 'type menstruation|spotting' }, 400);
  if (b.id) {
    // Edit existing: update end_date/flow/type (fixes "can't log period end").
    const res = await env.DB.prepare(
      'UPDATE periods SET end_date=?, flow=?, type=? WHERE id=? AND user_id=?'
    ).bind(b.end_date ?? null, b.flow ?? null, type, b.id, user.id).run();
    if (!res.meta?.changes) return json({ error: 'not found' }, 404);
  } else {
    await env.DB.prepare(
      'INSERT INTO periods (id,user_id,start_date,end_date,flow,type) VALUES (?,?,?,?,?,?)'
    ).bind(uid(), user.id, b.start_date, b.end_date ?? null, b.flow ?? null, type).run();
  }
  return json(await buildState(env, user.id, request));
}

export async function onRequestDelete({ request, env }: any) {
  const user = await requireUser(env, request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json({ error: 'id required' }, 400);
  await env.DB.prepare('DELETE FROM periods WHERE id=? AND user_id=?').bind(id, user.id).run();
  return json(await buildState(env, user.id, request));
}
