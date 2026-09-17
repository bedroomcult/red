import { describe, it, expect } from 'vitest';
import { onRequestPost } from './periods';
import { makeDb } from '../../test/d1-shim';

// A start date logged during (or just after) an ongoing period must extend that
// period, not create a second row. Two rows paint overlapping blocks, reset the
// cycle-day counter mid-bleed, and split one episode in the history.
const USER = 'user-1';

function env(periodLen = 5) {
  const db = makeDb();
  db.users.push({ id: USER, email: 'a@b.com', pass_hash: 'x', salt: 's', created_at: '2026-01-01T00:00:00Z', display_name: null, cycle_len: 28, period_len: periodLen });
  db.sessions.push({ token: 'tok', user_id: USER, expires_at: new Date(Date.now() + 864e5).toISOString() });
  return { DB: db, db };
}

const post = (e: any, body: any) =>
  onRequestPost({
    request: new Request('https://api.test/api/periods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'sess=tok' },
      body: JSON.stringify(body),
    }),
    env: e,
  });

describe('POST /api/periods merging', () => {
  it('extends an ongoing period when a start lands inside it', async () => {
    const e = env();
    await post(e, { start_date: '2026-09-01', type: 'menstruation' });
    const res = await post(e, { start_date: '2026-09-03', type: 'menstruation' });
    expect(res.status).toBe(200);
    expect(e.db.periods.length).toBe(1);
    expect(e.db.periods[0].start_date).toBe('2026-09-01');
    expect(e.db.periods[0].end_date).toBe('2026-09-03');
  });

  it('extends an ongoing period when a start lands within the 2-day gap', async () => {
    const e = env();
    await post(e, { start_date: '2026-09-01', type: 'menstruation' });
    // Range is 09-01..09-05; 09-07 is 2 days later.
    await post(e, { start_date: '2026-09-07', type: 'menstruation' });
    expect(e.db.periods.length).toBe(1);
    expect(e.db.periods[0].end_date).toBe('2026-09-07');
  });

  it('creates a new period when the start is beyond the gap', async () => {
    const e = env();
    await post(e, { start_date: '2026-09-01', type: 'menstruation' });
    await post(e, { start_date: '2026-09-10', type: 'menstruation' });
    expect(e.db.periods.length).toBe(2);
  });

  it('does not merge into a finished period', async () => {
    const e = env();
    await post(e, { start_date: '2026-09-01', end_date: '2026-09-05', type: 'menstruation' });
    await post(e, { start_date: '2026-09-07', type: 'menstruation' });
    expect(e.db.periods.length).toBe(2);
  });

  it('never merges spotting into a period', async () => {
    const e = env();
    await post(e, { start_date: '2026-09-01', type: 'menstruation' });
    await post(e, { start_date: '2026-09-03', type: 'spotting' });
    expect(e.db.periods.length).toBe(2);
  });

  it('uses the configured period_len when judging the gap', async () => {
    const e = env(8);
    await post(e, { start_date: '2026-09-01', type: 'menstruation' });
    await post(e, { start_date: '2026-09-10', type: 'menstruation' });
    expect(e.db.periods.length).toBe(1);
  });

  it('still updates an existing row when an id is given', async () => {
    const e = env();
    await post(e, { start_date: '2026-09-01', type: 'menstruation' });
    const id = e.db.periods[0].id;
    const res = await post(e, { id, start_date: '2026-09-01', end_date: '2026-09-04', type: 'menstruation' });
    expect(res.status).toBe(200);
    expect(e.db.periods.length).toBe(1);
    expect(e.db.periods[0].end_date).toBe('2026-09-04');
  });

  it('returns 404 when updating an id that does not belong to the user', async () => {
    const e = env();
    e.db.periods.push({ id: 'other', user_id: 'someone', start_date: '2026-09-01', end_date: null, flow: null, type: 'menstruation' });
    const res = await post(e, { id: 'other', start_date: '2026-09-01', end_date: '2026-09-04', type: 'menstruation' });
    expect(res.status).toBe(404);
  });
});
