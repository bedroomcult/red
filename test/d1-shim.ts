// Test-only in-memory shim for the tiny subset of the D1 API that
// functions/api/auth.ts uses. Any new query added to auth.ts must be added
// here too, or the guard below throws — a permissive fake would let a
// genuinely broken query pass silently.
//
// Supported statements:
//   INSERT INTO users (id,email,pass_hash,salt,created_at) VALUES (?,?,?,?,?)
//   SELECT id FROM users WHERE email=?
//   SELECT id,pass_hash,salt FROM users WHERE email=?
//   UPDATE users SET pass_hash=? WHERE id=?
//   INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)
//   DELETE FROM sessions WHERE token=?
//   SELECT display_name, cycle_len, period_len FROM users WHERE id=?
//   SELECT id,start_date,end_date,flow,type FROM periods WHERE user_id=? ORDER BY start_date
//   SELECT id,pill_type,regimen,pack_start_date FROM pill_regimens WHERE user_id=? ORDER BY pack_start_date DESC LIMIT 1
//   SELECT id,ec_type,intake_at,upsi_at FROM ec_events WHERE user_id=? AND intake_at>? ORDER BY intake_at DESC
//   SELECT date,taken FROM dose_logs WHERE user_id=? AND date>=? ORDER BY date
//   SELECT date,protected FROM sex_events WHERE user_id=? AND date>=? ORDER BY date
//   DELETE FROM sex_events WHERE user_id=? AND date=?
//   INSERT INTO sex_events (id,user_id,date,protected,note,created_at) VALUES (?,?,?,?,?,?)
//   INSERT INTO ec_events (id,user_id,ec_type,intake_at,upsi_at) VALUES (?,?,?,?,?)
//   SELECT id FROM ec_events WHERE id=? AND user_id=?
//   UPDATE ec_events SET ec_type=?, intake_at=?, upsi_at=? WHERE id=? AND user_id=?
//   DELETE FROM ec_events WHERE id=? AND user_id=?
//   SELECT user_id, expires_at FROM sessions WHERE token=?
//   SELECT id, email FROM users WHERE id=?

type Row = Record<string, any>;

function norm(sql: string): string {
  return sql.trim().replace(/\s+/g, ' ').toUpperCase();
}

export function makeDb() {
  const users: Row[] = [];
  const sessions: Row[] = [];
  const periods: Row[] = [];
  const regimens: Row[] = [];
  const ec: Row[] = [];
  const symptoms: Row[] = [];
  const doses: Row[] = [];
  const sex: Row[] = [];

  function run(sql: string, args: any[]) {
    const s = norm(sql);

    if (s.startsWith('INSERT INTO USERS')) {
      const [id, email, pass_hash, salt, created_at] = args;
      if (users.some((u) => u.email === email)) {
        throw new Error('UNIQUE constraint failed: users.email');
      }
      users.push({ id, email, pass_hash, salt, created_at });
      return { meta: { changes: 1 } };
    }

    if (s.startsWith('INSERT INTO SESSIONS')) {
      const [token, user_id, expires_at] = args;
      sessions.push({ token, user_id, expires_at });
      return { meta: { changes: 1 } };
    }

    if (s.startsWith('UPDATE USERS')) {
      const [pass_hash, id] = args;
      const u = users.find((x) => x.id === id);
      if (!u) return { meta: { changes: 0 } };
      u.pass_hash = pass_hash;
      return { meta: { changes: 1 } };
    }

    if (s.startsWith('DELETE FROM SESSIONS')) {
      const [token] = args;
      const before = sessions.length;
      for (let i = sessions.length - 1; i >= 0; i--) if (sessions[i].token === token) sessions.splice(i, 1);
      return { meta: { changes: before - sessions.length } };
    }

    if (s.startsWith('DELETE FROM DOSE_LOGS')) {
      const [user_id, date] = args;
      const before = doses.length;
      for (let i = doses.length - 1; i >= 0; i--) {
        if (doses[i].user_id === user_id && doses[i].date === date) doses.splice(i, 1);
      }
      return { meta: { changes: before - doses.length } };
    }

    if (s.startsWith('INSERT INTO DOSE_LOGS')) {
      const [id, user_id, date, taken] = args;
      doses.push({ id, user_id, date, taken });
      return { meta: { changes: 1 } };
    }

    if (s.startsWith('DELETE FROM SEX_EVENTS')) {
      const [user_id, date] = args;
      const before = sex.length;
      for (let i = sex.length - 1; i >= 0; i--) {
        if (sex[i].user_id === user_id && sex[i].date === date) sex.splice(i, 1);
      }
      return { meta: { changes: before - sex.length } };
    }

    if (s.startsWith('INSERT INTO EC_EVENTS')) {
      const [id, user_id, ec_type, intake_at, upsi_at] = args;
      ec.push({ id, user_id, ec_type, intake_at, upsi_at });
      return { meta: { changes: 1 } };
    }

    if (s.startsWith('UPDATE EC_EVENTS')) {
      const [ec_type, intake_at, upsi_at, id, user_id] = args;
      const row = ec.find((x) => x.id === id && x.user_id === user_id);
      if (!row) return { meta: { changes: 0 } };
      Object.assign(row, { ec_type, intake_at, upsi_at });
      return { meta: { changes: 1 } };
    }

    if (s.startsWith('DELETE FROM EC_EVENTS')) {
      const [id, user_id] = args;
      const before = ec.length;
      for (let i = ec.length - 1; i >= 0; i--) {
        if (ec[i].id === id && ec[i].user_id === user_id) ec.splice(i, 1);
      }
      return { meta: { changes: before - ec.length } };
    }

    if (s.startsWith('INSERT INTO SEX_EVENTS')) {
      const [id, user_id, date, protectedFlag, note, created_at] = args;
      sex.push({ id, user_id, date, protected: protectedFlag, note, created_at });
      return { meta: { changes: 1 } };
    }

    throw new Error('d1-shim: unsupported SQL: ' + sql);
  }

  function first(sql: string, args: any[]) {
    const s = norm(sql);
    if (s.startsWith('SELECT ID FROM USERS WHERE EMAIL=?')) {
      const [email] = args;
      return users.find((u) => u.email === email) ?? null;
    }
    if (s.startsWith('SELECT ID,PASS_HASH,SALT FROM USERS WHERE EMAIL=?')) {
      const [email] = args;
      return users.find((u) => u.email === email) ?? null;
    }
    if (s.startsWith('SELECT USER_ID, EXPIRES_AT FROM SESSIONS WHERE TOKEN=?')) {
      const [token] = args;
      const row = sessions.find((x) => x.token === token);
      return row ? { user_id: row.user_id, expires_at: row.expires_at } : null;
    }
    if (s.startsWith('SELECT ID FROM EC_EVENTS WHERE ID=? AND USER_ID=?')) {
      const [id, user_id] = args;
      const row = ec.find((x) => x.id === id && x.user_id === user_id);
      return row ? { id: row.id } : null;
    }
    if (s.startsWith('SELECT ID, EMAIL FROM USERS WHERE ID=?')) {
      const [id] = args;
      const u = users.find((x) => x.id === id);
      return u ? { id: u.id, email: u.email } : null;
    }
    if (s.startsWith('SELECT DISPLAY_NAME, CYCLE_LEN, PERIOD_LEN FROM USERS WHERE ID=?')) {
      const [id] = args;
      return users.find((u) => u.id === id) ?? null;
    }
    if (s.startsWith('SELECT ID,PILL_TYPE,REGIMEN,PACK_START_DATE FROM PILL_REGIMENS')) {
      const [user_id] = args;
      const rows = regimens
        .filter((r) => r.user_id === user_id)
        .sort((a, b) => String(b.pack_start_date).localeCompare(String(a.pack_start_date)));
      return rows[0] ?? null;
    }
    throw new Error('d1-shim: unsupported SQL: ' + sql);
  }

  function all(sql: string, args: any[]) {
    const s = norm(sql);
    if (s.startsWith('SELECT ID FROM USERS')) {
      return { results: users.map((u) => ({ id: u.id })) };
    }
    if (s.startsWith('SELECT ID,START_DATE,END_DATE,FLOW,TYPE FROM PERIODS')) {
      const [user_id] = args;
      return {
        results: periods
          .filter((p) => p.user_id === user_id)
          .sort((a, b) => String(a.start_date).localeCompare(String(b.start_date))),
      };
    }
    if (s.startsWith('SELECT ID,EC_TYPE,INTAKE_AT,UPSI_AT FROM EC_EVENTS')) {
      const [user_id, cutoff] = args;
      return {
        results: ec
          .filter((e) => e.user_id === user_id && String(e.intake_at) > String(cutoff))
          .sort((a, b) => String(b.intake_at).localeCompare(String(a.intake_at))),
      };
    }
    if (s.startsWith('SELECT KIND FROM SYMPTOMS')) {
      const [user_id, date] = args;
      return { results: symptoms.filter((x) => x.user_id === user_id && x.date === date) };
    }
    if (s.startsWith('SELECT DATE,TAKEN FROM DOSE_LOGS')) {
      const [user_id, from] = args;
      return {
        results: doses
          .filter((d) => d.user_id === user_id && String(d.date) >= String(from))
          .sort((a, b) => String(a.date).localeCompare(String(b.date)))
          .map((d) => ({ date: d.date, taken: d.taken })),
      };
    }
    if (s.startsWith('SELECT DATE,PROTECTED FROM SEX_EVENTS')) {
      const [user_id, from] = args;
      return {
        results: sex
          .filter((x) => x.user_id === user_id && String(x.date) >= String(from))
          .sort((a, b) => String(a.date).localeCompare(String(b.date)))
          .map((x) => ({ date: x.date, protected: x.protected })),
      };
    }
    throw new Error('d1-shim: unsupported SQL: ' + sql);
  }

  function prepare(sql: string) {
    const bound = (args: any[]) => ({
      first: () => Promise.resolve(first(sql, args)),
      all: () => Promise.resolve(all(sql, args)),
      run: () => Promise.resolve(run(sql, args)),
    });
    return {
      bind: (...args: any[]) => bound(args),
      first: () => Promise.resolve(first(sql, [])),
      all: () => Promise.resolve(all(sql, [])),
      run: () => Promise.resolve(run(sql, [])),
    };
  }

  return { prepare, users, sessions, periods, regimens, ec, symptoms, doses, sex };
}
