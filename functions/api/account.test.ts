import { describe, it, expect } from 'vitest';
import { onRequestDelete, onRequestGet } from './account';
import { makeDb } from '../../test/d1-shim';
import { uid, sessionToken } from '../_lib';

// Deleting an account is irreversible and destroys years of health data, so the
// guard matters more than the feature. These pin that a wrong or missing
// confirmation changes nothing, and that a correct one clears every table.

const EMAIL = 'user@example.com';
const TOKEN = 'sess-token-1';

function setup() {
  const db = makeDb();
  const id = uid();
  db.users.push({
    id, email: EMAIL, pass_hash: 'x', salt: 's',
    created_at: new Date().toISOString(), display_name: 'A', cycle_len: 28, period_len: 5,
  });
  db.sessions.push({ token: TOKEN, user_id: id, expires_at: new Date(Date.now() + 864e5).toISOString() });
  db.periods.push({ id: uid(), user_id: id, start_date: '2026-09-06', end_date: '2026-09-10', flow: 'medium', type: 'menstruation' });
  db.symptoms.push({ id: uid(), user_id: id, date: '2026-09-06', kind: 'cramps' });
  db.doses.push({ id: uid(), user_id: id, date: '2026-09-06', taken: 1 });
  db.sex.push({ id: uid(), user_id: id, date: '2026-09-06', protected: 0, created_at: new Date().toISOString() });
  const env = { DB: db };
  const req = (confirm?: string) => new Request(
    'https://x/api/account' + (confirm !== undefined ? '?confirm=' + encodeURIComponent(confirm) : ''),
    { method: 'DELETE', headers: { Cookie: `sess=${TOKEN}` } }
  );
  return { db, env, id, req };
}

describe('DELETE /api/account', () => {
  it('refuses without a confirmation', async () => {
    const { env, req, db } = setup();
    const res = await onRequestDelete({ request: req(), env });
    expect(res.status).toBe(400);
    expect(db.users.length).toBe(1);
    expect(db.periods.length).toBe(1);
  });

  it('refuses a wrong confirmation, leaving every table intact', async () => {
    const { env, req, db } = setup();
    const res = await onRequestDelete({ request: req('wrong@example.com'), env });
    expect(res.status).toBe(400);
    expect(db.users.length).toBe(1);
    expect(db.periods.length).toBe(1);
    expect(db.symptoms.length).toBe(1);
    expect(db.doses.length).toBe(1);
  });

  it('accepts the account email and clears the data', async () => {
    const { env, req, db } = setup();
    const res = await onRequestDelete({ request: req(EMAIL), env });
    expect(res.status).toBe(200);
    expect(db.users.length).toBe(0);
    expect(db.periods.length).toBe(0);
    expect(db.symptoms.length).toBe(0);
    expect(db.doses.length).toBe(0);
    expect(db.sex.length).toBe(0);
    // Sessions go too, so the cleared cookie is not the only thing ending it.
    expect(db.sessions.length).toBe(0);
  });

  it('clears the session cookie on success', async () => {
    const { env, req } = setup();
    const res = await onRequestDelete({ request: req(EMAIL), env });
    expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });

  it('requires a session', async () => {
    const { env } = setup();
    const res = await onRequestDelete({
      request: new Request('https://x/api/account?confirm=' + EMAIL, { method: 'DELETE' }),
      env,
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/account', () => {
  it('exports the stored rows', async () => {
    const { env, req } = setup();
    const res = await onRequestGet({
      request: new Request('https://x/api/account', { headers: { Cookie: `sess=${TOKEN}` } }),
      env,
    });
    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.format).toBe('red-export-v1');
    expect(body.account.email).toBe(EMAIL);
    expect(body.periods.length).toBe(1);
    expect(body.symptoms.length).toBe(1);
    // 0/1 stored in D1, exported as booleans so the file reads without the schema.
    expect(body.dose_logs[0].taken).toBe(true);
    expect(body.sex_events[0].protected).toBe(false);
  });

  it('requires a session', async () => {
    const { env } = setup();
    const res = await onRequestGet({ request: new Request('https://x/api/account'), env });
    expect(res.status).toBe(401);
  });
});
