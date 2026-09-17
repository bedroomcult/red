import { describe, it, expect } from 'vitest';
import { onRequestPost, onRequestDelete } from './sex';
import { buildState } from '../_lib';
import { makeDb } from '../../test/d1-shim';

// One log per calendar day: the calendar renders a single heart per date, so a
// second entry has nowhere to go. Posting again must replace, not append.
const USER = 'user-1';

function env() {
  const db = makeDb();
  db.users.push({ id: USER, email: 'a@b.com', pass_hash: 'x', salt: 's', created_at: '2026-01-01T00:00:00Z', display_name: null, cycle_len: 28, period_len: 5 });
  db.sessions.push({ token: 'tok', user_id: USER, expires_at: new Date(Date.now() + 864e5).toISOString() });
  return { DB: db, db };
}

const call = (e: any, method: 'POST' | 'DELETE', body?: any, query = '') =>
  method === 'POST'
    ? onRequestPost({
        request: new Request('https://api.test/api/sex' + query, {
          method,
          headers: { 'Content-Type': 'application/json', Cookie: 'sess=tok' },
          body: JSON.stringify(body),
        }),
        env: e,
      })
    : onRequestDelete({
        request: new Request('https://api.test/api/sex' + query, { method, headers: { Cookie: 'sess=tok' } }),
        env: e,
      });

describe('POST /api/sex', () => {
  it('logs unprotected sex', async () => {
    const e = env();
    const res = await call(e, 'POST', { date: '2026-03-05', protected: false });
    expect(res.status).toBe(200);
    expect(e.db.sex.length).toBe(1);
    expect(e.db.sex[0].protected).toBe(0);
  });

  it('logs protected sex', async () => {
    const e = env();
    await call(e, 'POST', { date: '2026-03-05', protected: true });
    expect(e.db.sex[0].protected).toBe(1);
  });

  it('treats a missing protected flag as unprotected', async () => {
    const e = env();
    await call(e, 'POST', { date: '2026-03-05' });
    expect(e.db.sex[0].protected).toBe(0);
  });

  it('replaces the entry for the same date instead of appending', async () => {
    const e = env();
    await call(e, 'POST', { date: '2026-03-05', protected: false });
    await call(e, 'POST', { date: '2026-03-05', protected: true });
    expect(e.db.sex.length).toBe(1);
    expect(e.db.sex[0].protected).toBe(1);
  });

  it('keeps different dates separate', async () => {
    const e = env();
    await call(e, 'POST', { date: '2026-03-05', protected: true });
    await call(e, 'POST', { date: '2026-03-06', protected: false });
    expect(e.db.sex.length).toBe(2);
  });

  it('rejects an impossible date without writing', async () => {
    const e = env();
    for (const date of ['2026-02-31', '2026-3-5', '', null]) {
      expect((await call(e, 'POST', { date })).status).toBe(400);
    }
    expect(e.db.sex.length).toBe(0);
  });

  it('rejects an unauthenticated request', async () => {
    const e = env();
    e.db.sessions.length = 0;
    expect((await call(e, 'POST', { date: '2026-03-05' })).status).toBe(401);
    expect(e.db.sex.length).toBe(0);
  });

  it('returns the full state including the new entry', async () => {
    const e = env();
    const today = new Date().toISOString().slice(0, 10);
    const body = await (await call(e, 'POST', { date: today, protected: true })).json();
    expect(body.sex).toEqual([{ date: today, protected: true }]);
  });
});

describe('DELETE /api/sex', () => {
  it('clears the entry for a date', async () => {
    const e = env();
    await call(e, 'POST', { date: '2026-03-05', protected: true });
    const res = await call(e, 'DELETE', undefined, '?date=2026-03-05');
    expect(res.status).toBe(200);
    expect(e.db.sex.length).toBe(0);
  });

  it('leaves other dates alone', async () => {
    const e = env();
    await call(e, 'POST', { date: '2026-03-05', protected: true });
    await call(e, 'POST', { date: '2026-03-06', protected: true });
    await call(e, 'DELETE', undefined, '?date=2026-03-05');
    expect(e.db.sex.map((s: any) => s.date)).toEqual(['2026-03-06']);
  });

  it('rejects a missing or malformed date', async () => {
    const e = env();
    expect((await call(e, 'DELETE')).status).toBe(400);
    expect((await call(e, 'DELETE', undefined, '?date=nope')).status).toBe(400);
  });
});

describe('buildState sex', () => {
  it('coerces protected to a boolean', async () => {
    const e = env();
    const today = new Date().toISOString().slice(0, 10);
    e.db.sex.push({ id: 's1', user_id: USER, date: today, protected: 1 });
    const s = await buildState({ DB: e.DB }, USER);
    expect(s.sex).toEqual([{ date: today, protected: true }]);
  });

  it('excludes entries older than the 90-day window', async () => {
    const e = env();
    const old = new Date(Date.now() - 200 * 864e5).toISOString().slice(0, 10);
    e.db.sex.push({ id: 's1', user_id: USER, date: old, protected: 1 });
    const s = await buildState({ DB: e.DB }, USER);
    expect(s.sex).toEqual([]);
  });
});
