import { requireUser, buildState, uid, jsonResponse } from '../_lib';
import { isIsoDate } from '../_dates';

const json = jsonResponse;

const TYPES = ['LNG', 'UPA', 'copper-IUD', 'copper'];

// id present => update that event instead of inserting a new one, so a mistyped
// dose can be corrected rather than deleted and re-entered.
export async function onRequestPost({ request, env }: any) {
  const user = await requireUser(env, request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  let b: any;
  try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  if (!TYPES.includes(b?.ec_type)) return json({ error: 'ec_type LNG|UPA|copper required' }, 400);
  if (!isIsoDate(b?.intake_date)) return json({ error: 'intake_date YYYY-MM-DD required' }, 400);
  if (b.upsi_date && !isIsoDate(b.upsi_date)) return json({ error: 'upsi_date YYYY-MM-DD' }, 400);
  // Stored as a midday UTC timestamp: the column is a datetime and the UI only
  // deals in whole days, so noon avoids the date shifting across timezones.
  const intakeAt = new Date(b.intake_date + 'T12:00:00Z').toISOString();
  const upsiAt = b.upsi_date ? new Date(b.upsi_date + 'T12:00:00Z').toISOString() : null;

  if (b.id) {
    const owned: any = await env.DB.prepare('SELECT id FROM ec_events WHERE id=? AND user_id=?').bind(b.id, user.id).first();
    if (!owned) return json({ error: 'not found' }, 404);
    await env.DB.prepare('UPDATE ec_events SET ec_type=?, intake_at=?, upsi_at=? WHERE id=? AND user_id=?')
      .bind(b.ec_type, intakeAt, upsiAt, b.id, user.id).run();
  } else {
    await env.DB.prepare(
      'INSERT INTO ec_events (id,user_id,ec_type,intake_at,upsi_at) VALUES (?,?,?,?,?)'
    ).bind(uid(), user.id, b.ec_type, intakeAt, upsiAt).run();
  }
  return json(await buildState(env, user.id, request));
}

export async function onRequestDelete({ request, env }: any) {
  const user = await requireUser(env, request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json({ error: 'id required' }, 400);
  await env.DB.prepare('DELETE FROM ec_events WHERE id=? AND user_id=?').bind(id, user.id).run();
  return json(await buildState(env, user.id, request));
}
