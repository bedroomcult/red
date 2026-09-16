import { requireUser, buildState, uid, jsonResponse } from '../_lib';
import { clientDate } from '../_today';
import { isIsoDate } from '../_dates';

const json = jsonResponse;



export async function onRequestPost({ request, env }: any) {
  const user = await requireUser(env, request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  let b: any;
  try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  if (!b?.pill_type || !b?.regimen || !isIsoDate(b?.pack_start_date))
    return json({ error: 'pill_type, regimen, pack_start_date YYYY-MM-DD required' }, 400);
  await env.DB.prepare('DELETE FROM pill_regimens WHERE user_id=?').bind(user.id).run();
  await env.DB.prepare(
    'INSERT INTO pill_regimens (id,user_id,pill_type,regimen,pack_start_date) VALUES (?,?,?,?,?)'
  ).bind(uid(), user.id, b.pill_type, b.regimen, b.pack_start_date).run();
  if (b.taken !== undefined) {
    const today = clientDate(request);
    await env.DB.prepare('DELETE FROM dose_logs WHERE user_id=? AND date=?').bind(user.id, today).run();
    await env.DB.prepare('INSERT INTO dose_logs (id,user_id,date,taken) VALUES (?,?,?,?)')
      .bind(uid(), user.id, today, b.taken ? 1 : 0).run();
  }
  return json(await buildState(env, user.id, request));
}

export async function onRequestDelete({ request, env }: any) {
  const user = await requireUser(env, request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  await env.DB.prepare('DELETE FROM pill_regimens WHERE user_id=?').bind(user.id).run();
  return json(await buildState(env, user.id, request));
}
