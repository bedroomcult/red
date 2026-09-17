import { requireUser, jsonResponse, sessCookie } from '../_lib';

const json = jsonResponse;

// GET  /api/account          -> full export of everything stored for this user
// DELETE /api/account?confirm=<email>  -> delete the account and all its rows
//
// Both exist because the app tells the user their data is theirs
// ("Data Anda tersimpan di akun Anda sendiri"). Storing health data without a
// way to get it out or destroy it contradicts that, and Indonesian PDP law
// requires both.

export async function onRequestGet({ request, env }: any) {
  const user = await requireUser(env, request);
  if (!user) return json({ error: 'unauthorized' }, 401);

  const [periods, bc, ec, symptoms, doses, sex, notes, profile] = await Promise.all([
    env.DB.prepare('SELECT id,start_date,end_date,flow,type FROM periods WHERE user_id=? ORDER BY start_date').bind(user.id).all(),
    env.DB.prepare('SELECT pill_type,regimen,pack_start_date FROM pill_regimens WHERE user_id=?').bind(user.id).all(),
    env.DB.prepare('SELECT ec_type,intake_at,upsi_at FROM ec_events WHERE user_id=? ORDER BY intake_at').bind(user.id).all(),
    env.DB.prepare('SELECT date,kind FROM symptoms WHERE user_id=? ORDER BY date').bind(user.id).all(),
    env.DB.prepare('SELECT date,taken FROM dose_logs WHERE user_id=? ORDER BY date').bind(user.id).all(),
    env.DB.prepare('SELECT date,protected FROM sex_events WHERE user_id=? ORDER BY date').bind(user.id).all(),
    env.DB.prepare('SELECT date,note FROM day_notes WHERE user_id=? ORDER BY date').bind(user.id).all(),
    env.DB.prepare('SELECT display_name,cycle_len,period_len,created_at FROM users WHERE id=?').bind(user.id).first(),
  ]);

  // taken/protected are stored as 0/1; export booleans so the file is readable
  // without knowing the schema.
  return json({
    exported_at: new Date().toISOString(),
    format: 'red-export-v1',
    account: { email: user.email, ...(profile ?? {}) },
    periods: periods.results,
    pill_regimens: bc.results,
    ec_events: ec.results,
    symptoms: symptoms.results,
    dose_logs: (doses.results as any[]).map((d) => ({ date: d.date, taken: !!d.taken })),
    sex_events: (sex.results as any[]).map((s) => ({ date: s.date, protected: !!s.protected })),
    day_notes: notes.results,
  });
}

export async function onRequestDelete({ request, env }: any) {
  const user = await requireUser(env, request);
  if (!user) return json({ error: 'unauthorized' }, 401);

  // Typing the account email is the confirmation. A single tap must not be able
  // to destroy years of logged health data, and this cannot be undone.
  const confirm = new URL(request.url).searchParams.get('confirm') ?? '';
  if (confirm.trim().toLowerCase() !== user.email.toLowerCase()) {
    return json({ error: 'confirm must equal the account email' }, 400);
  }

  // Every table keyed by user_id. Listed explicitly rather than by convention so
  // a future table is a conscious addition here, not a silent orphan.
  const TABLES = ['periods', 'pill_regimens', 'dose_logs', 'ec_events', 'symptoms', 'sex_events', 'day_notes'];
  for (const t of TABLES) {
    await env.DB.prepare(`DELETE FROM ${t} WHERE user_id=?`).bind(user.id).run();
  }
  await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id).run();
  await env.DB.prepare('DELETE FROM users WHERE id=?').bind(user.id).run();

  return json({ ok: true }, 200, { 'Set-Cookie': sessCookie('', true) });
}
