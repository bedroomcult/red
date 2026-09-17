import { requireUser, buildState, uid, jsonResponse } from '../_lib';
import { isIsoDate } from '../_dates';

const json = jsonResponse;

// One log per day: the calendar has a single heart per date, so a second entry
// would have nowhere to render. Posting again for the same date updates it.
// `protected` records whether contraception was used; `note` is free text.
export async function onRequestPost({ request, env }: any) {
  const user = await requireUser(env, request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  let b: any;
  try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  if (!isIsoDate(b?.date)) return json({ error: 'date YYYY-MM-DD required' }, 400);
  const protectedFlag = b?.protected === true;
  const note = typeof b?.note === 'string' ? b.note.slice(0, 500) : null;

  // Delete-then-insert, matching doses.ts: no unique constraint on (user_id, date).
  await env.DB.prepare('DELETE FROM sex_events WHERE user_id=? AND date=?').bind(user.id, b.date).run();
  await env.DB.prepare(
    'INSERT INTO sex_events (id,user_id,date,protected,note,created_at) VALUES (?,?,?,?,?,?)'
  ).bind(uid(), user.id, b.date, protectedFlag ? 1 : 0, note, new Date().toISOString()).run();
  return json(await buildState(env, user.id, request));
}

// Clearing a day's log. The calendar heart is toggled off by tapping the same
// button again, which sends DELETE rather than a second POST.
export async function onRequestDelete({ request, env }: any) {
  const user = await requireUser(env, request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  const date = new URL(request.url).searchParams.get('date');
  if (!isIsoDate(date)) return json({ error: 'date YYYY-MM-DD required' }, 400);
  await env.DB.prepare('DELETE FROM sex_events WHERE user_id=? AND date=?').bind(user.id, date).run();
  return json(await buildState(env, user.id, request));
}
