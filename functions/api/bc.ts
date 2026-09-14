import { requireUser, buildState, uid } from '../_lib';

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

const isDate = (s: unknown) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));

export async function onRequestPost({ request, env }: any) {
  const user = await requireUser(env, request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  let b: any;
  try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  if (!b?.pill_type || !b?.regimen || !isDate(b?.pack_start_date))
    return json({ error: 'pill_type, regimen, pack_start_date YYYY-MM-DD required' }, 400);
  await env.DB.prepare('DELETE FROM pill_regimens WHERE user_id=?').bind(user.id).run();
  await env.DB.prepare(
    'INSERT INTO pill_regimens (id,user_id,pill_type,regimen,pack_start_date) VALUES (?,?,?,?,?)'
  ).bind(uid(), user.id, b.pill_type, b.regimen, b.pack_start_date).run();
  if (b.taken !== undefined) {
    const today = new Date().toISOString().slice(0, 10);
    await env.DB.prepare('DELETE FROM dose_logs WHERE user_id=? AND date=?').bind(user.id, today).run();
    await env.DB.prepare('INSERT INTO dose_logs (id,user_id,date,taken) VALUES (?,?,?,?)')
      .bind(uid(), user.id, today, b.taken ? 1 : 0).run();
  }
  return json(await buildState(env, user.id));
}

export async function onRequestDelete({ request, env }: any) {
  const user = await requireUser(env, request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  await env.DB.prepare('DELETE FROM pill_regimens WHERE user_id=?').bind(user.id).run();
  return json(await buildState(env, user.id));
}
