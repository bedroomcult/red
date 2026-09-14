import { requireUser, buildState } from '../_lib';

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

export async function onRequestGet({ request, env }: any) {
  const user = await requireUser(env, request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const row = await env.DB.prepare('SELECT display_name, cycle_len, period_len FROM users WHERE id=?').bind(user.id).first();
  return json({ profile: row ?? {} });
}

export async function onRequestPost({ request, env }: any) {
  const user = await requireUser(env, request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  let b: any;
  try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }

  const name = typeof b?.display_name === 'string' ? b.display_name.trim().slice(0, 40) : null;
  const cycle = Number.isFinite(b?.cycle_len) ? Math.min(60, Math.max(15, Math.round(b.cycle_len))) : null;
  const period = Number.isFinite(b?.period_len) ? Math.min(15, Math.max(1, Math.round(b.period_len))) : null;

  await env.DB.prepare('UPDATE users SET display_name=?, cycle_len=?, period_len=? WHERE id=?')
    .bind(name, cycle, period, user.id).run();
  return json(await buildState(env, user.id));
}
