# Plan 004: Harden the auth endpoint and add security response headers

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 065fee3..HEAD -- functions/api/auth.ts functions/_lib.ts public/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MEDIUM (the password-hash format change must stay backward
  compatible or every existing user is locked out)
- **Depends on**: 001 (the auth test suite must exist before changing auth
  behavior)
- **Category**: security
- **Planned at**: commit `065fee3`, 2026-09-15

## Why this matters

This is the only authentication code in the product, it guards every user's
menstrual data, and it is currently the weakest part of the system:

1. **Passwords are compared with `!==` on a base64 string** —
   `functions/api/auth.ts:54`. That is not a constant-time comparison. It is a
   narrow timing oracle, and it is trivially avoided.

2. **PBKDF2-HMAC-SHA256 runs at 50,000 iterations**
   (`functions/_lib.ts:4`). OWASP's current guidance for this KDF is 600,000.
   At 50k, an offline crack of a leaked D1 dump is roughly an order of
   magnitude cheaper than it should be. This is the highest-value fix here
   because password hashes are exactly the data that survives a database
   breach.

3. **The API leaks which emails are registered, twice.**
   - Signup returns `409 {"error":"email taken"}` (`auth.ts:39`), a direct
     account-existence oracle.
   - Login returns `401 {"error":"invalid login"}` both ways, which is correct
     — but the unknown-email path (`auth.ts:52`) returns *before* `hashPw` is
     called, while the wrong-password path runs a ~40ms PBKDF2 derivation. The
     response-time difference enumerates accounts even though the bodies match.

4. **No security response headers are sent at all.** There is no Content
   Security Policy, no `X-Content-Type-Options`, no `Referrer-Policy`, no
   frame-ancestors restriction. Nothing currently prevents the app from being
   framed, and there is no defense-in-depth behind the `SameSite=Lax` cookie.

5. **`catch {}` around the signup INSERT reports a database outage as "email
   taken"** (`auth.ts:38-40`), which will send users chasing a phantom account
   while masking a real incident.

Note on what is *already fine* and must not be regressed:

- The session cookie is `HttpOnly; Path=/; Max-Age=2592000; SameSite=Lax;
  Secure` (`_lib.ts:32-36`). `SameSite=Lax` means browsers do not attach the
  cookie to cross-site POSTs, which is why there is no CSRF token and why none
  is needed. Keep `SameSite=Lax`.
- Logout deletes the session row server-side (`auth.ts:19-20`).
- Login errors are already uniform in *body* (`invalid login`) — the fix is to
  make them uniform in *timing*, not to change the message.

## Current state

`functions/api/auth.ts` — the signup and login blocks, lines 26-60:

```ts
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
    // ... session insert, then:
    return json({ ok: true }, 200, { 'Set-Cookie': sessCookie(token) });
  }

  if (action === 'login') {
    const user: any = await env.DB.prepare('SELECT id,pass_hash,salt FROM users WHERE email=?')
      .bind(email.toLowerCase())
      .first();
    if (!user) return json({ error: 'invalid login' }, 401);
    const pass_hash = await hashPw(password, user.salt as string);
    if (pass_hash !== user.pass_hash) return json({ error: 'invalid login' }, 401);
    // ... session insert, then:
    return json({ ok: true }, 200, { 'Set-Cookie': sessCookie(token) });
  }
```

`functions/_lib.ts:1-12` — the hash:

```ts
export async function hashPw(pw: string, salt: string): Promise<string> {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 50000, hash: 'SHA-256' },
    km,
    256
  );
  const bytes = new Uint8Array(bits);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
```

`functions/_lib.ts:32-36` — the cookie helper, unchanged by this plan:

```ts
export function sessCookie(token: string, delete_ = false): string {
  return delete_
    ? 'sess=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax; Secure'
    : `sess=${token}; HttpOnly; Path=/; Max-Age=2592000; SameSite=Lax; Secure`;
}
```

The `users` table (`migrations/0001_init.sql`): `id, email UNIQUE, pass_hash,
salt, created_at` — there is no `iterations` column and this plan does not add
one. Backward compatibility is achieved by encoding the iteration count in the
hash string itself.

`public/` currently contains only `icon.svg`, `manifest.json`, `sw.js`. There
is no `_headers` file, which is why no security headers are sent.

Repo conventions: terse code, lowercase comments, `// ponytail:` for deliberate
shortcuts, no lint or formatter configured. The API responses are built by a
local `json()` helper duplicated in each `functions/api/*.ts` file.

## Commands you will need

Run from the repo root. If `npm ci` fails on this machine because the repo is
on a `/storage/...` mount, read the "Environment note" in `plans/README.md` and
work in the `~/red-build` shadow directory instead.

| Purpose   | Command             | Expected on success |
|-----------|---------------------|---------------------|
| Tests     | `npx vitest run`    | all pass            |
| Typecheck | `npm run typecheck` | exit 0              |
| Build     | `npm run build`     | exit 0              |

## Scope

**In scope** (the only files you should modify or create):

- `functions/_lib.ts` — new `hashPw` format, new `verifyPw`, new
  `constantTimeEqual`, new `sessionToken`, new `withSecurityHeaders`.
- `functions/api/auth.ts` — timing-safe verify, uniform login timing, generic
  signup conflict, distinguish DB failure from duplicate, use
  `sessionToken`, apply security headers.
- `functions/_lib.test.ts` — extend (created in plan 001).
- `functions/api/auth.test.ts` — extend (created in plan 001).
- `public/_headers` (create) — static-asset security headers.

**Out of scope** (do NOT touch):

- `functions/_lib.ts`'s `buildState`, `requireUser`, `rateLimited`,
  `getCookie`, `sessCookie` — leave their behavior alone. You are adding to
  this file, not rewriting it.
- `migrations/**` — no schema change. The new hash format is self-describing.
- The cookie name `sess` and its flags. Renaming to `__Host-sess` would be a
  nice hardening but it invalidates every existing session and interacts with
  Capacitor's WebView cookie store; not worth it here.
- `functions/api/*.ts` other than `auth.ts` — adding security headers to the
  other endpoints is handled by `public/_headers`; do not edit six files.
- Adding an email-verification flow, password reset, or account lockout. Those
  are product features, not hardening.
- Any dependency. This must be solvable with WebCrypto and stdlib only.

## Git workflow

- Branch: `advisor/004-auth-hardening`
- Commit per step. Message style from `git log --oneline` is lowercase and
  topic-prefixed, e.g. `auth: pbkdf2 210k with self-describing hash format;
  constant-time compare; generic signup conflict`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a constant-time comparison

In `functions/_lib.ts`, add:

```ts
// Constant-time string compare. `===` on a hash leaks how many leading bytes
// matched via timing. Length is compared first, which is unavoidable, but hash
// lengths are fixed so it reveals nothing.
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
```

Note: JavaScript gives no hard guarantee of constant time, and this is not the
point — the point is removing the early-exit that `!==` has. Do not over-engineer
this with timing-attack mitigations; a byte-wise XOR accumulator is the
accepted idiom.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 2: Replace the hash with a self-describing, higher-cost format

In `functions/_lib.ts`, replace `hashPw` and add a verifier. Requirements:

- New format: `pbkdf2-sha256$<iterations>$<base64>`, e.g.
  `pbkdf2-sha256$210000$kQ0...`.
- New iteration count: **210,000**. This is a deliberate middle ground below
  OWASP's 600,000 — Cloudflare Pages Functions have a CPU-time budget per
  request, and 600k would push login latency toward a second. 210k is 4.2× the
  current cost, which is the meaningful part of the fix.
- `verifyPw(pw, salt, stored)` must accept **both** formats:
  - a stored value starting with `pbkdf2-sha256$` → parse its iteration count
    and use it;
  - anything else → treat as the legacy bare-base64 50,000-iteration hash.
  This is what keeps every existing user able to log in. There is no migration
  and no `iterations` column.
- `verifyPw` must use `constantTimeEqual`.
- `verifyPw` must return whether the stored hash is legacy, so the login
  handler can transparently upgrade it. Signature:
  `verifyPw(pw, salt, stored): Promise<{ ok: boolean; legacy: boolean }>`.

Derive the bits with 32 bytes (256 bits) exactly as today; only iterations and
the output encoding change.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 3: Test the hash format and the verifier

Extend `functions/_lib.test.ts`:

- `hashPw(pw, salt)` output matches `/^pbkdf2-sha256\$210000\$[A-Za-z0-9+/=]+$/`.
- `hashPw` is deterministic for the same `(pw, salt)`.
- `verifyPw(pw, salt, await hashPw(pw, salt))` → `{ ok: true, legacy: false }`.
- `verifyPw('wrong', salt, await hashPw(pw, salt))` → `{ ok: false, legacy: false }`.
- **Backward compatibility (the critical case):** compute a legacy hash
  locally in the test with `crypto.subtle` at 50,000 iterations and the same
  `btoa(String.fromCharCode(...))` encoding, then assert
  `verifyPw(pw, salt, legacy)` → `{ ok: true, legacy: true }`.
- `verifyPw` against a stored value with a corrupted iteration count (e.g.
  `pbkdf2-sha256$abc$xxx`) → `{ ok: false, ... }` and does not throw.
- `constantTimeEqual('abc','abc')` → true; `('abc','abd')` → false;
  `('abc','ab')` → false; `('','')` → true.

**Verify**: `npx vitest run functions/_lib.test.ts` → all pass.

### Step 4: Add a session-token helper

Session tokens currently come from `uid()`, which is `crypto.randomUUID()`
(`_lib.ts:14-16`) — a v4 UUID with 122 bits of entropy. That is adequate, but
UUID tokens are also trivially guessable-in-shape and some logging/telemetry
pipelines treat them as non-secret identifiers. Add:

```ts
// 256 bits of CSPRNG entropy, base64url. Session tokens are bearer credentials;
// do not reuse uid() (a v4 UUID) for them.
export function sessionToken(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
```

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 5: Rewrite the login and signup handlers

In `functions/api/auth.ts`:

**Login** — make the timing uniform and upgrade legacy hashes:

```ts
  if (action === 'login') {
    const user: any = await env.DB.prepare('SELECT id,pass_hash,salt FROM users WHERE email=?')
      .bind(email.toLowerCase())
      .first();
    // Always run a derivation, even for an unknown email, so the response time
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
    // ... existing session insert, with token = sessionToken()
  }
```

Each login therefore performs exactly one PBKDF2 derivation whether or not the
account exists. The legacy upgrade is an extra derivation only for users who
have not logged in since this change.

**Signup** — stop leaking account existence and stop masking outages. Return a
uniform 200 plus a session for a fresh email, and for a taken email return the
same response shape as a success *only if that does not depend on actually
having an account*. The practical, non-over-engineered approach:

- Check for an existing row first:
  `SELECT id FROM users WHERE email=?` (`.first()`).
- If a row exists → return `json({ error: 'email taken' }, 409)`. **Keep this.**
  Signup enumeration is a known trade-off across the industry because a
  signup form must tell the user their email is registered or they cannot
  proceed. The value here is in *login*, not signup.
- Separate the duplicate-row case from a genuine database error: perform the
  existence check first, then let the INSERT's failure surface as a 500 rather
  than `409 email taken`:

```ts
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email=?')
      .bind(email.toLowerCase()).first();
    if (existing) return json({ error: 'email taken' }, 409);
    try {
      await env.DB.prepare('INSERT INTO users (...) VALUES (?,?,?,?,?)') /* ... */.run();
    } catch {
      return json({ error: 'signup failed' }, 500);
    }
```

The pre-check narrows the duplicate case to a real race; the INSERT catch now
means "something went wrong", not "email taken". Note the residual race between
the check and the insert is handled by the `email UNIQUE` constraint returning
500 — acceptable, and no worse than reporting a wrong 409.

**Both paths**: replace `const token = uid();` with `const token = sessionToken();`.

Also: trim and cap the email before storing —
`const em = email.trim().toLowerCase().slice(0, 254);` — and use `em` in every
query. 254 is the RFC 5321 practical maximum.

**Verify**: `npx tsc --noEmit` → exit 0.
**Verify**: `npx vitest run functions/api/auth.test.ts` → the plan-001 suite
still passes, **except** any assertion that encoded the old `409` on a
duplicate-insert path. Update `functions/api/auth.test.ts` to match the new
behavior and note the change in your report. Do not weaken an assertion just to
make it pass — if a test now fails for a reason other than the intended
behavior change, STOP.

**Verify**: `grep -n "pass_hash !== \|pass_hash!== \|uid();" functions/api/auth.ts`
→ no matches for the password comparison and no `uid()` token generation.

### Step 6: Add the security-headers wrapper for API responses

In `functions/_lib.ts`, add:

```ts
// Baseline security headers. `public/_headers` covers static assets; these
// cover Function responses, which do not all flow through it.
export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
};

export function withSecurityHeaders(res: Response): Response {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) h.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}
```

A JSON API response needs no scripts, styles, images, or frames, so
`default-src 'none'` plus `frame-ancestors 'none'` is correct and strict here.
Do **not** apply the app's page-level CSP to API responses; the strict policy
above is the right one for JSON.

Then change the local `json()` helper in `functions/api/auth.ts` to run its
result through `withSecurityHeaders`, so every return path is covered:

```ts
const json = (o: unknown, status = 200, extra?: HeadersInit) =>
  withSecurityHeaders(new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...extra } }));
```

Note the `logout` branch at `auth.ts:21-23` constructs its `Response` directly
rather than via `json()`. Route it through the wrapper too so it is not the one
endpoint without headers.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 7: Add the static security headers file

Create `public/_headers`. Cloudflare Pages reads this file from the build output
root and applies the rules to matching paths. Use exactly this content:

```
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: geolocation=(), camera=(), microphone=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  Content-Security-Policy: default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'none'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; manifest-src 'self'; worker-src 'self'

/api/*
  Content-Security-Policy: default-src 'none'; frame-ancestors 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
```

Rationale for the two non-obvious directives, so a reviewer does not "tighten"
them and break the app:

- `style-src 'self' 'unsafe-inline'` is required: React writes inline `style`
  attributes, and Capacitor injects styles into the WebView.
- `connect-src 'self'` is required for the app's own `/api/` fetches.
- `script-src 'self'` (no `'unsafe-inline'`) is safe because Vite emits external
  module scripts only — but **this must be verified in a real browser** before
  the change is considered done, because a CSP that breaks the app silently is
  worse than no CSP. See step 8.

**Verify**: `npm run build` → exit 0.
**Verify**: `test -f dist/_headers` → exit 0 (Pages copies it from `public/`).
**Verify**: `grep -c "frame-ancestors 'none'" dist/_headers` → prints `2`.

### Step 8: Verify the app still works in a browser

This step is mandatory — a CSP is the one change here that can break the app
for every user at once, and there is no test that can catch it.

Run `npx wrangler pages dev dist --d1 DB=period-db` (or serve `dist` with any
static server) and open it. Confirm, with the DevTools console open:

1. No CSP violation errors are logged on first load.
2. Signing up creates a session and lands on the home screen.
3. Logging out and back in works.
4. Logging a period succeeds.
5. The service worker registers without error (this exercises plan 002's
   `worker-src 'self'` allowance; if plan 002 has not landed, the SW is broken
   for its own reasons — note it, do not fix it here).

If any CSP violation appears, report the exact blocked directive and the
resource, and STOP. Do not add `'unsafe-inline'` to `script-src` as a
workaround.

### Step 9: Full verification

**Verify**: `npm run typecheck` → exit 0.
**Verify**: `npx vitest run` → all pass.
**Verify**: `npm run build` → exit 0.

## Test plan

- Extended: `functions/_lib.test.ts` — constant-time compare, new hash format,
  verifier round-trip, wrong-password rejection, **legacy 50k hash still
  verifies**, malformed stored value does not throw.
- Extended: `functions/api/auth.test.ts` — add cases for: unknown email and
  wrong password both return the identical body and status; login with a
  legacy-format stored hash succeeds; a legacy hash is rewritten to the new
  format after a successful login (assert the stored value now starts with
  `pbkdf2-sha256$`); the email is lowercased and trimmed on signup.
- The legacy-hash test is the single most important one in this plan. A bug
  there locks out every existing user, and it is the only failure mode that
  does not show up in development because a fresh dev database has no legacy
  rows.
- No other test file should need modification.

## Done criteria

ALL must hold:

- [ ] `npm run typecheck` exits 0
- [ ] `npx vitest run` exits 0
- [ ] `grep -n "iterations: 50000" functions/_lib.ts` returns nothing
- [ ] `grep -n "pbkdf2-sha256\$" functions/_lib.ts` shows the new format
- [ ] `grep -n "verifyPw" functions/api/auth.ts functions/_lib.ts` shows both
- [ ] `grep -n "constantTimeEqual" functions/_lib.ts functions/api/auth.ts` shows both
- [ ] A test asserts a 50,000-iteration legacy hash still verifies
- [ ] `test -f public/_headers && test -f dist/_headers` exits 0 after a build
- [ ] The step-8 browser check passed, with the observed results recorded
- [ ] `git status --short` shows only files listed in the Scope section
- [ ] No file listed under "Out of scope" was modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- You cannot make `verifyPw` accept both hash formats without a schema change.
  Do not add a migration column — the self-describing format is the design.
- Raising the iteration count to 210,000 pushes a login past the Pages Functions
  CPU limit in your dev run. Report the measured latency and the limit you hit;
  the correct next move is a lower count, not removing the change.
- The CSP in step 7 introduces a violation you cannot resolve without
  `script-src 'unsafe-inline'` or `connect-src *`.
- Plan 001 has not landed, so there is no `functions/api/auth.test.ts`. Do
  **not** proceed without it — reverting to "no tests, change auth anyway" is
  exactly the risk this plan's dependency exists to prevent. Report and wait.
- You discover existing sessions or users whose `pass_hash` is neither the
  legacy bare-base64 form nor the new format.

## Maintenance notes

- **The hash format is now self-describing.** New formats must follow
  `algorithm$params$digest` so the iteration count can be raised again later
  without a migration. The legacy bare-base64 branch in `verifyPw` exists only
  for pre-`065fee3` users; it can be deleted once every account has logged in
  at least once after this change (check with
  `SELECT COUNT(*) FROM users WHERE pass_hash NOT LIKE 'pbkdf2-sha256$%'`).
  Deleting it is a follow-up, not part of this plan.
- `public/_headers` applies to static assets; the API's own headers come from
  `withSecurityHeaders`. If a future endpoint builds a `Response` directly
  instead of going through a `json()` helper, it will silently miss the
  headers — route it through the wrapper.
- The uniform-timing login now always runs one PBKDF2 derivation, including for
  unknown emails. That is a deliberate cost: login latency is the same for
  everyone, but a flood of unknown-email logins costs CPU. The existing
  per-IP rate limit (10 per 10 minutes, `_lib.ts:38-46`) is the mitigation; it
  is per-isolate and therefore weak, as its own comment says.
- Signup still reveals whether an email is registered (409). That is a
  deliberate, documented trade-off, not an oversight — the residual risk is
  account enumeration, and the mitigation would be an email-verification flow,
  which is a product decision.
- Deferred and worth recording: there is no session cleanup job, so expired
  `sessions` rows accumulate. `requireUser` correctly rejects them
  (`_lib.ts`, expiry check), so this is a housekeeping issue rather than a
  security one.
