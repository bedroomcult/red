import { describe, it, expect } from 'vitest';
import { onRequestPost, onRequestDelete } from './ec';
import { makeDb } from '../../test/d1-shim';

// EC events previously could only be created, never corrected or removed, and
// there was no indicator that one was active. These cover the edit path.
const USER = 'user-1';

function env() {
  const db = makeDb();
  db.users.push({ id: USER, email: 'a@b.com', pass_hash: 'x', salt: 's', created_at: '2026-01-01T00:00:00Z', display_name: null, cycle_len: 28, period_len: 5 });
  db.sessions.push({ token: 'tok', user_id: USER, expires_at: new Date(Date.now() + 864e5).toISOString() });
  return { DB: db, db };
}

const post = (e: any, body: any) =>
  onRequestPost({
    request: new Request('https://api.test/api/ec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'sess=tok' },
      body: JSON.stringify(body),
    }),
    env: e,
  });

const del = (e: any, query: string) =>
  onRequestDelete({ request: new Request('https://api.test/api/ec' + query, { method: 'DELETE', headers: { Cookie: 'sess=tok' } }), env: e });

describe('POST /api/ec', () => {
  it('creates an event from date inputs', async () => {
    const e = env();
    const res = await post(e, { ec_type: 'LNG', intake_date: '2026-03-05' });
    expect(res.status).toBe(200);
    expect(e.db.ec.length).toBe(1);
    expect(e.db.ec[0].intake_at).toBe('2026-03-05T12:00:00.000Z');
    expect(e.db.ec[0].upsi_at).toBeNull();
  });

  it('stores an optional UPSI date', async () => {
    const e = env();
    await post(e, { ec_type: 'UPA', intake_date: '2026-03-05', upsi_date: '2026-03-04' });
    expect(e.db.ec[0].upsi_at).toBe('2026-03-04T12:00:00.000Z');
  });

  it('updates in place when an id is supplied', async () => {
    const e = env();
    await post(e, { ec_type: 'LNG', intake_date: '2026-03-05' });
    const id = e.db.ec[0].id;
    const res = await post(e, { id, ec_type: 'UPA', intake_date: '2026-03-06' });
    expect(res.status).toBe(200);
    expect(e.db.ec.length).toBe(1);
    expect(e.db.ec[0].ec_type).toBe('UPA');
    expect(e.db.ec[0].intake_at).toBe('2026-03-06T12:00:00.000Z');
  });

  it('clears the UPSI date when it is omitted on update', async () => {
    const e = env();
    await post(e, { ec_type: 'LNG', intake_date: '2026-03-05', upsi_date: '2026-03-04' });
    await post(e, { id: e.db.ec[0].id, ec_type: 'LNG', intake_date: '2026-03-05' });
    expect(e.db.ec[0].upsi_at).toBeNull();
  });

  it('refuses to update an event owned by another user', async () => {
    const e = env();
    e.db.ec.push({ id: 'other', user_id: 'someone-else', ec_type: 'LNG', intake_at: '2026-03-05T12:00:00.000Z', upsi_at: null });
    const res = await post(e, { id: 'other', ec_type: 'UPA', intake_date: '2026-03-06' });
    expect(res.status).toBe(404);
    expect(e.db.ec[0].ec_type).toBe('LNG');
  });

  it('rejects an unknown type and an impossible date', async () => {
    const e = env();
    expect((await post(e, { ec_type: 'aspirin', intake_date: '2026-03-05' })).status).toBe(400);
    expect((await post(e, { ec_type: 'LNG', intake_date: '2026-02-31' })).status).toBe(400);
    expect((await post(e, { ec_type: 'LNG' })).status).toBe(400);
    expect(e.db.ec.length).toBe(0);
  });
});

describe('DELETE /api/ec', () => {
  it('removes an event by id', async () => {
    const e = env();
    await post(e, { ec_type: 'LNG', intake_date: '2026-03-05' });
    const res = await del(e, '?id=' + e.db.ec[0].id);
    expect(res.status).toBe(200);
    expect(e.db.ec.length).toBe(0);
  });

  it('requires an id', async () => {
    const e = env();
    expect((await del(e, '')).status).toBe(400);
  });
});
