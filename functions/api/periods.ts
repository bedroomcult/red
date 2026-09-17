import { requireUser, buildState, uid, jsonResponse } from '../_lib';
import { isIsoDate } from '../_dates';
import { periodToExtend } from '../_cycle';

const json = jsonResponse;


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
  if (!isIsoDate(b?.start_date)) return json({ error: 'start_date YYYY-MM-DD required' }, 400);
  if (b.end_date && !isIsoDate(b.end_date)) return json({ error: 'end_date YYYY-MM-DD' }, 400);
  const type = b.type ?? 'menstruation';
  if (!['menstruation', 'spotting'].includes(type)) return json({ error: 'type menstruation|spotting' }, 400);
  if (b.id) {
    // Edit existing: update end_date/flow/type (fixes "can't log period end").
    const res = await env.DB.prepare(
      'UPDATE periods SET end_date=?, flow=?, type=? WHERE id=? AND user_id=?'
    ).bind(b.end_date ?? null, b.flow ?? null, type, b.id, user.id).run();
    if (!res.meta?.changes) return json({ error: 'not found' }, 404);
  } else {
    // A start within MERGE_GAP_DAYS of an ongoing period extends that period
    // instead of adding a row. Otherwise one continuous bleed becomes two
    // rows, which paints overlapping blocks and resets the cycle-day counter.
    const profile: any = await env.DB.prepare('SELECT period_len FROM users WHERE id=?').bind(user.id).first();
    const periodLen = profile?.period_len ?? 5;
    const { results: existing } = await env.DB.prepare(
      'SELECT id,start_date,end_date,flow,type FROM periods WHERE user_id=? ORDER BY start_date'
    ).bind(user.id).all();
    const target = type === 'menstruation' ? periodToExtend(existing as any[], b.start_date, periodLen) : undefined;
    if (target) {
      // Extend to the later of the two start dates, so the episode spans both.
      const end = b.start_date > target.start_date ? b.start_date : target.start_date;
      await env.DB.prepare('UPDATE periods SET end_date=? WHERE id=? AND user_id=?')
        .bind(end, target.id, user.id).run();
    } else {
      await env.DB.prepare(
        'INSERT INTO periods (id,user_id,start_date,end_date,flow,type) VALUES (?,?,?,?,?,?)'
      ).bind(uid(), user.id, b.start_date, b.end_date ?? null, b.flow ?? null, type).run();
    }
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
