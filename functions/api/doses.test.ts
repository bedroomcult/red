import { describe, it, expect } from 'vitest';
import { onRequestPost } from './doses';
import { buildState } from '../_lib';
import { makeDb } from '../../test/d1-shim';

// Medication logs are editable on any date, so the endpoint has to accept a past
// or future date, allow clearing, and reject junk without touching the row.
const USER = 'user-1';

function env() {
  const db = makeDb();
  db.users.push({ id: USER, email: 'a@b.com', pass_hash: 'x', salt: 's', created_at: '2026-01-01T00:00:00Z', display_name: null, cycle_len: 28, period_len: 5 });
  return { DB: db, db };
}

function post(env: any, body: any) {
  return onRequestPost({
    request: new Request('https://api.test/api/doses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'sess=tok' },
      body: JSON.stringify(body),
    }),
    env,
  });
}

// requireUser reads the session from D1, so seed one.
function withSession(e: any) {
  e.db.sessions.push({ token: 'tok', user_id: USER, expires_at: new Date(Date.now() + 864e5).toISOString() });
  return e;
}

describe('POST /api/doses', () => {
  it('records a taken dose on any date', async () => {
    const e = withSession(env());
    const res = await post(e, { date: '2026-03-05', taken: true });
    expect(res.status).toBe(200);
    expect(e.db.doses).toEqual([{ id: expect.any(String), user_id: USER, date: '2026-03-05', taken: 1 }]);
  });

  it('records a missed dose', async () => {
    const e = withSession(env());
    await post(e, { date: '2026-03-05', taken: false });
    expect(e.db.doses[0].taken).toBe(0);
  });

  it('replaces an existing log for the same date rather than adding a row', async () => {
    const e = withSession(env());
    await post(e, { date: '2026-03-05', taken: true });
    await post(e, { date: '2026-03-05', taken: false });
    expect(e.db.doses.length).toBe(1);
    expect(e.db.doses[0].taken).toBe(0);
  });

  it('clears the log when taken is null', async () => {
    const e = withSession(env());
    await post(e, { date: '2026-03-05', taken: true });
    const res = await post(e, { date: '2026-03-05', taken: null });
    expect(res.status).toBe(200);
    expect(e.db.doses.length).toBe(0);
  });

  it('leaves other dates alone when clearing one', async () => {
    const e = withSession(env());
    await post(e, { date: '2026-03-05', taken: true });
    await post(e, { date: '2026-03-06', taken: true });
    await post(e, { date: '2026-03-05', taken: null });
    expect(e.db.doses.map((d: any) => d.date)).toEqual(['2026-03-06']);
  });

  it('accepts a future date', async () => {
    const e = withSession(env());
    const res = await post(e, { date: '2099-01-01', taken: true });
    expect(res.status).toBe(200);
  });

  it('rejects a malformed or impossible date without writing', async () => {
    const e = withSession(env());
    for (const date of ['2026-3-5', '2026-02-31', 'today', '', null, 20260305]) {
      const res = await post(e, { date, taken: true });
      expect(res.status).toBe(400);
    }
    expect(e.db.doses.length).toBe(0);
  });

  it('rejects a taken value that is not true, false or null', async () => {
    const e = withSession(env());
    for (const taken of ['yes', 1, 0, {}]) {
      const res = await post(e, { date: '2026-03-05', taken });
      expect(res.status).toBe(400);
    }
    expect(e.db.doses.length).toBe(0);
  });

  it('rejects an unauthenticated request', async () => {
    const e = env(); // no session seeded
    const res = await post(e, { date: '2026-03-05', taken: true });
    expect(res.status).toBe(401);
    expect(e.db.doses.length).toBe(0);
  });

  it('returns the full state so the client does not need a second request', async () => {
    const e = withSession(env());
    // Must be inside the 90-day window buildState reads, hence "today" rather
    // than a fixed date.
    const today = new Date().toISOString().slice(0, 10);
    const res = await post(e, { date: today, taken: true });
    const body = await res.json();
    expect(body.doses).toEqual([{ date: today, taken: true }]);
    expect(body.periods).toEqual([]);
  });
});

// buildState is what the calendar reads, so the doses it returns must be the
// 90-day window with taken coerced to a boolean.
describe('buildState doses', () => {
  it('returns taken as a boolean, not 0/1', async () => {
    const e = env();
    const today = new Date().toISOString().slice(0, 10);
    e.db.doses.push({ id: 'd1', user_id: USER, date: today, taken: 1 });
    const s = await buildState({ DB: e.DB }, USER);
    expect(s.doses).toEqual([{ date: today, taken: true }]);
  });

  it('excludes logs older than the 90-day window', async () => {
    const e = env();
    const old = new Date(Date.now() - 200 * 864e5).toISOString().slice(0, 10);
    e.db.doses.push({ id: 'd1', user_id: USER, date: old, taken: 1 });
    const s = await buildState({ DB: e.DB }, USER);
    expect(s.doses).toEqual([]);
  });

  it('returns doses sorted by date', async () => {
    const e = env();
    const recent = (d: number) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);
    e.db.doses.push(
      { id: 'd1', user_id: USER, date: recent(1), taken: 1 },
      { id: 'd2', user_id: USER, date: recent(3), taken: 0 }
    );
    const s = await buildState({ DB: e.DB }, USER);
    expect(s.doses.map((d: any) => d.date)).toEqual([recent(3), recent(1)]);
  });
});
