// Test-only in-memory shim for the tiny subset of the D1 API that
// functions/api/auth.ts uses. Any new query added to auth.ts must be added
// here too, or the guard below throws — a permissive fake would let a
// genuinely broken query pass silently.
//
// Supported statements:
//   INSERT INTO users (id,email,pass_hash,salt,created_at) VALUES (?,?,?,?,?)
//   SELECT id FROM users WHERE email=?
//   SELECT id,pass_hash,salt FROM users WHERE email=?
//   INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)
//   DELETE FROM sessions WHERE token=?

type Row = Record<string, any>;

function norm(sql: string): string {
  return sql.trim().replace(/\s+/g, ' ').toUpperCase();
}

export function makeDb() {
  const users: Row[] = [];
  const sessions: Row[] = [];

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

    if (s.startsWith('DELETE FROM SESSIONS')) {
      const [token] = args;
      const before = sessions.length;
      for (let i = sessions.length - 1; i >= 0; i--) if (sessions[i].token === token) sessions.splice(i, 1);
      return { meta: { changes: before - sessions.length } };
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
    throw new Error('d1-shim: unsupported SQL: ' + sql);
  }

  function all(sql: string, args: any[]) {
    const s = norm(sql);
    if (s.startsWith('SELECT ID FROM USERS')) {
      return { results: users.map((u) => ({ id: u.id })) };
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

  return { prepare, users, sessions };
}
