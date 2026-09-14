import { hashPw, uid, getCookie, sessCookie, rateLimited } from '../_lib';

const json = (o: unknown, status = 200, extra?: HeadersInit) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...extra } });

export async function onRequestPost({ request, env }: any) {
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
  if (rateLimited(ip)) return json({ error: 'too many attempts' }, 429);

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
    return new Response('{}', {
      headers: { 'Content-Type': 'application/json', 'Set-Cookie': sessCookie('', true) },
    });
  }

  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password)
    return json({ error: 'email+password required' }, 400);
  if (password.length < 8) return json({ error: 'password min 8 chars' }, 400);

  if (action === 'signup') {
    const salt = uid();
    const pass_hash = await hashPw(password, salt);
    const id = uid();
    try {
      await env.DB.prepare('INSERT INTO users (id,email,pass_hash,salt,created_at) VALUES (?,?,?,?,?)')
        .bind(id, email.toLowerCase(), pass_hash, salt, new Date().toISOString())
        .run();
    } catch {
      return json({ error: 'email taken' }, 409);
    }
    const token = uid();
    await env.DB.prepare('INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)')
      .bind(token, id, new Date(Date.now() + 30 * 864e5).toISOString())
      .run();
    return json({ ok: true }, 200, { 'Set-Cookie': sessCookie(token) });
  }

  if (action === 'login') {
    const user: any = await env.DB.prepare('SELECT id,pass_hash,salt FROM users WHERE email=?')
      .bind(email.toLowerCase())
      .first();
    if (!user) return json({ error: 'invalid login' }, 401);
    const pass_hash = await hashPw(password, user.salt as string);
    if (pass_hash !== user.pass_hash) return json({ error: 'invalid login' }, 401);
    const token = uid();
    await env.DB.prepare('INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)')
      .bind(token, user.id, new Date(Date.now() + 30 * 864e5).toISOString())
      .run();
    return json({ ok: true }, 200, { 'Set-Cookie': sessCookie(token) });
  }

  return json({ error: 'unknown action' }, 400);
}
