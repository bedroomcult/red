import { requireUser, buildState, uid, jsonResponse } from '../_lib';
import { isIsoDate } from '../_dates';

const json = jsonResponse;

// Any date can be edited, not just today, so the pill history can be corrected.
// taken: true = taken, false = missed, null/absent = clear the log.
export async function onRequestPost({ request, env }: any) {
  const user = await requireUser(env, request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  let b: any;
  try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  if (!isIsoDate(b?.date)) return json({ error: 'date YYYY-MM-DD required' }, 400);
  const taken = b?.taken;
  if (taken !== true && taken !== false && taken !== null && taken !== undefined)
    return json({ error: 'taken must be true, false or null' }, 400);

  // Delete-then-insert: dose_logs has no unique constraint on (user_id, date),
  // and the row is a single value, so replacing it is simpler than upserting.
  await env.DB.prepare('DELETE FROM dose_logs WHERE user_id=? AND date=?').bind(user.id, b.date).run();
  if (taken === true || taken === false) {
    await env.DB.prepare('INSERT INTO dose_logs (id,user_id,date,taken) VALUES (?,?,?,?)')
      .bind(uid(), user.id, b.date, taken ? 1 : 0).run();
  }
  return json(await buildState(env, user.id, request));
}
