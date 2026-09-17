import { hashPw, verifyPw, uid, sessionToken, getCookie, sessCookie, rateLimited, jsonResponse } from '../_lib';

const json = jsonResponse;

export async function onRequestPost({ request, env }: any) {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
  if (await rateLimited(env, ip)) return json({ error: 'too many attempts' }, 429);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }
  const { action, email, password } = body ?? {};

  if (action === 'logout') {
    const token = getCookie(request, 'sess');
    if (token) await env.DB.prepare('DELETE FROM sessions WHERE token=?').bind(token).run();
    return json({}, 200, { 'Set-Cookie': sessCookie('', true) });
  }

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password)
    return json({ error: 'email+password required' }, 400);
  if (password.length < 8) return json({ error: 'password min 8 chars' }, 400);
  // RFC 5321 practical maximum, and normalised once so every query agrees.
  const em = email.trim().toLowerCase().slice(0, 254);

  if (action === 'signup') {
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(em).first();
    if (existing) return json({ error: 'email taken' }, 409);
    const salt = uid();
    const pass_hash = await hashPw(password, salt);
    const id = uid();
    try {
      await env.DB.prepare('INSERT INTO users (id,email,pass_hash,salt,created_at) VALUES (?,?,?,?,?)')
        .bind(id, em, pass_hash, salt, new Date().toISOString())
        .run();
    } catch {
      // Not a duplicate: the pre-check above handled that. Something is wrong.
      return json({ error: 'signup failed' }, 500);
    }
    const token = sessionToken();
    await env.DB.prepare('INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)')
      .bind(token, id, new Date(Date.now() + 30 * 864e5).toISOString())
      .run();
    return json({ ok: true }, 200, { 'Set-Cookie': sessCookie(token) });
  }

  if (action === 'login') {
    const user: any = await env.DB.prepare('SELECT id,pass_hash,salt FROM users WHERE email=?')
      .bind(em)
      .first();
    // Always run one derivation, even for an unknown email, so response time
    // does not reveal whether the account exists.
    const salt = user ? (user.salt as string) : uid();
    const stored = user ? (user.pass_hash as string) : '';
    const { ok, legacy } = await verifyPw(password, salt, stored);
    if (!user || !ok) return json({ error: 'invalid login' }, 401);
    // Transparently re-hash to the current cost on successful login.
    if (legacy) {
      const fresh = await hashPw(password, salt);
      await env.DB.prepare('UPDATE users SET pass_hash=? WHERE id=?').bind(fresh, user.id).run();
    }
    const token = sessionToken();
    await env.DB.prepare('INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)')
      .bind(token, user.id, new Date(Date.now() + 30 * 864e5).toISOString())
      .run();
    return json({ ok: true }, 200, { 'Set-Cookie': sessCookie(token) });
  }

  return json({ error: 'unknown action' }, 400);
}
