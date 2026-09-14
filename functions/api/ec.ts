import { requireUser, buildState, uid } from '../_lib';

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

export async function onRequestPost({ request, env }: any) {
  const user = await requireUser(env, request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  let b: any;
  try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  if (!['LNG', 'UPA'].includes(b?.ec_type)) return json({ error: 'ec_type LNG|UPA required' }, 400);
  if (!b?.intake_at || isNaN(Date.parse(b.intake_at))) return json({ error: 'intake_at ISO datetime required' }, 400);
  if (b.upsi_at && isNaN(Date.parse(b.upsi_at))) return json({ error: 'upsi_at ISO datetime' }, 400);
  await env.DB.prepare(
    'INSERT INTO ec_events (id,user_id,ec_type,intake_at,upsi_at) VALUES (?,?,?,?,?)'
  ).bind(uid(), user.id, b.ec_type, b.intake_at, b.upsi_at ?? null).run();
  return json(await buildState(env, user.id));
}
