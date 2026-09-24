# Plan 002: Stop the service worker caching API responses (and fix its broken syntax)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**:
> `git diff --stat 065fee3..HEAD -- public/sw.js src/main.tsx`
> If either file changed since this plan was written, compare the "Current
> state" excerpt against the live file before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: correctness / security
- **Planned at**: commit `065fee3`, 2026-09-15

## Why this matters

Two defects live in the same 15-line file, and the second only becomes visible
once the first is fixed.

**1. The service worker never registers.** `public/sw.js` is served to the
browser verbatim — Vite copies `public/` without transpiling. The file is
written in TypeScript, using `(e as any)` casts. `as` is not JavaScript
syntax, so the browser refuses to parse the script and registration fails
outright. `src/main.tsx:9` swallows that failure with `.catch(() => {})`, so
the app has looked healthy while being silently offline-incapable.

This is not a theoretical reading — the file currently deployed to production
is the same broken source. Running `node --check` on it fails with
`SyntaxError: Unexpected identifier 'as'`, and `curl
https://cycle-tracker-3hg.pages.dev/sw.js` returns the `as any` casts
verbatim.

**2. If it were fixed naively, it would leak data between users.** The fetch
handler is cache-first for every same-origin `GET`. `/api/me` is a same-origin
`GET`, so once a user is logged in, their authenticated `me` payload (cycles,
symptoms, birth-control state, notes) would be written to `caches.open('pt-v1')`
and served from cache on every later load — forever, with no revalidation.
Logging out and logging in as a different person on the same device would serve
the previous person's cycle data.

The fix is small but must address both: make the file valid JavaScript, and
take `/api/` out of the cache path entirely.

## Current state

`public/sw.js` in full (15 lines):

```js
self.addEventListener('install', (e) => (e as any).waitUntil((self as any).skipWaiting()));
self.addEventListener('activate', (e) => (e as any).waitUntil((self as any).clients.claim()));
self.addEventListener('fetch', (e) => {
  const req = (e as any).request;
  if (req.method !== 'GET' || !req.url.startsWith((self as any).location.origin)) return;
  (e as any).respondWith(
    caches.open('pt-v1').then((c) =>
      c.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res.ok) c.put(req, res.clone());
            return res;
          })
      )
    )
  );
});
```

The registration site, `src/main.tsx:8-10`:

```tsx
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
```

Conventions to match:

- `public/` is copied verbatim by Vite and is not typechecked (`tsconfig.json`
  includes `src`, `lib`, `functions`, and the config files only). Anything in
  `public/` must be valid plain JavaScript or a static asset.
- Cache names in this repo are not versioned by build; `pt-v1` is the only one.
- Source style is terse with lowercase comments; `// ponytail:` marks
  deliberate shortcuts.

## Commands you will need

Run from the repo root. If `npm ci` fails on this machine because the repo is
on a `/storage/...` mount, read the "Environment note" in `plans/README.md` and
work in the `~/red-build` shadow directory instead.

| Purpose             | Command                                   | Expected on success          |
|---------------------|-------------------------------------------|------------------------------|
| Syntax gate         | `node --check public/sw.js`               | exit 0, no output            |
| Tests               | `npx vitest run`                          | all pass                     |
| Typecheck           | `npm run typecheck`                       | exit 0 (plan 001 adds this)  |
| Build               | `npm run build`                           | exit 0; `dist/sw.js` exists  |
| Confirm no TS casts | `grep -c "as any" public/sw.js`           | prints `0`                   |

`node --check` is the key gate. The production outage was caused by a syntax
error that no existing check caught, so add this habit: any change to
`public/sw.js` must be followed by `node --check public/sw.js`.

## Scope

**In scope** (the only files you should modify or create):

- `public/sw.js` (rewrite)
- `src/main.tsx` (registration error handling only)
- `test/sw-routing.test.ts` (create)

**Out of scope** (do NOT touch):

- `public/manifest.json` — its icon list is SVG-only, which Chrome will not
  accept for an installable PWA (needs 192px and 512px PNGs). That is a real
  gap but it requires raster assets that this plan cannot author; the app ships
  as an APK, so it is deferred. Do not edit the manifest here.
- `src/App.tsx`, any `src/*.tsx` screen — the SW is not wired into app state.
- `functions/**` — server behavior is unchanged.
- `vite.config.ts` — do not add a SW plugin (e.g. `vite-plugin-pwa`). The point
  of the current design is zero extra dependencies; keep it.

## Git workflow

- Branch: `advisor/002-sw-api-cache`
- Commit per step. Message style from `git log --oneline` is lowercase and
  topic-prefixed, e.g. `sw: fix TS syntax (worker never registered); make /api/
  network-only`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Rewrite `public/sw.js` as valid JavaScript

Write the file to do exactly three things: pre-cache nothing, clean old caches
on activate, and serve navigations/static assets cache-first while sending all
`/api/` requests straight to the network.

Requirements:

- Valid plain JS only. No `as`, no type annotations, no `any`.
- The fetch handler must **return early without calling `respondWith`** for:
  - any non-`GET` request, and
  - any request whose pathname starts with `/api/`.
  Returning early (rather than `respondWith(fetch(req))`) is required so the
  browser handles the request natively — this keeps cookies, `Set-Cookie`, and
  streaming behavior untouched.
- Keep the existing same-origin guard.
- Bump the cache name to `pt-v2`.
- On `activate`, delete every cache whose name is not `pt-v2`, then claim
  clients. This evicts any `pt-v1` entries a user may have accumulated.
- Keep `skipWaiting()` on install.

A shape that satisfies this — write equivalent code, not necessarily this text:

```js
// Cache-first for static assets and navigations. /api/ is never cached: the
// responses are authenticated and per-user, and a shared cache would leak one
// user's cycle data to the next person on the device.
const CACHE = 'pt-v2';

self.addEventListener('install', (e) => e.waitUntil(self.skipWaiting()));

self.addEventListener('activate', (e) =>
  e.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  )
);

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  e.respondWith(
    caches.open(CACHE).then((c) =>
      c.match(req).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res.ok) c.put(req, res.clone());
            return res;
          })
      )
    )
  );
});
```

**Verify**: `node --check public/sw.js` → exit 0, no output.
**Verify**: `grep -c "as any" public/sw.js` → prints `0`.
**Verify**: `grep -n "pathname.startsWith('/api/')" public/sw.js` → one match.

### Step 2: Stop swallowing the registration failure

In `src/main.tsx`, change the registration so a failure is visible in the
console instead of silently discarded, while still not breaking the app.

Replace `.catch(() => {})` with a handler that logs, e.g.
`.catch((err) => console.warn('SW registration failed', err))`. Keep the
`'serviceWorker' in navigator` guard and the `load` listener exactly as they
are.

Do not add retry logic or reload-on-update behavior — out of scope.

**Verify**: `npx tsc --noEmit` → exit 0.
**Verify**: `grep -n "SW registration failed" src/main.tsx` → one match.

### Step 3: Test the routing decision

Create `test/sw-routing.test.ts`. It loads `public/sw.js` as text, evaluates it
in a fabricated worker global scope, and inspects which requests the fetch
handler claims.

The test harness shape:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const SRC = readFileSync(resolve(__dirname, '../public/sw.js'), 'utf8');

function loadWorker() {
  const listeners: Record<string, (e: any) => void> = {};
  const put: string[] = [];
  const self: any = {
    location: { origin: 'https://app.test' },
    addEventListener: (name: string, fn: any) => { listeners[name] = fn; },
    skipWaiting: () => {}, clients: { claim: () => {} },
  };
  const ctx: any = {
    self,
    caches: {
      open: async () => ({ match: async () => null, put: async (r: any) => { put.push(r.url); } }),
      keys: async () => ['pt-v1', 'pt-v2'],
      delete: async () => true,
    },
    fetch: async () => new Response('ok', { status: 200 }),
    URL, Response, Promise, console,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return { listeners, put };
}
```

Then assert, for each case, whether the fetch listener calls `respondWith` on a
fake event object that records the call:

1. `GET https://app.test/api/me` → `respondWith` **not** called.
2. `POST https://app.test/api/periods` → not called.
3. `GET https://app.test/assets/index-abc.js` → called.
4. `GET https://other.test/api/me` → not called (cross-origin).
5. `GET https://app.test/` (navigation) → called.

Also assert the event object records no `respondWith` call whose argument
resolved to a cache write for any `/api/` URL.

Note `__dirname` is available because the repo's `tsconfig.json` targets a
Node-compatible module setting; if Vitest complains, use
`new URL('../public/sw.js', import.meta.url)` instead.

**Verify**: `npx vitest run test/sw-routing.test.ts` → all pass.

### Step 4: Build and confirm the file ships unmodified

**Verify**: `npm run build` → exit 0.
**Verify**: `node --check dist/sw.js` → exit 0.
**Verify**: `grep -c "as any" dist/sw.js` → prints `0`.
**Verify**: `npx vitest run` → every test passes (the 27 pre-existing, the
drift and auth tests from plan 001 if it has landed, plus the new SW routing
tests).

### Step 5: Verify against production after deploy

Only if the operator has deployed the change. Otherwise record this as
outstanding in your report.

**Verify**: `curl -s https://cycle-tracker-3hg.pages.dev/sw.js | node --check /dev/stdin` → exit 0.
**Verify**: in a desktop browser, open the site, log in, then in DevTools →
Application → Cache Storage confirm `pt-v1` is gone and no `/api/` entry exists
in `pt-v2`.

## Test plan

- New: `test/sw-routing.test.ts` — five routing cases plus a cache-write
  assertion, all against the real `public/sw.js` source rather than a copy.
- `node --check public/sw.js` is a hard gate in steps 1 and 4; the original
  defect was a syntax error, so a syntax check is the primary regression guard
  here.
- No existing test should need modification. If one breaks, STOP.

## Done criteria

ALL must hold:

- [ ] `node --check public/sw.js` exits 0
- [ ] `grep -c "as any" public/sw.js` prints `0`
- [ ] `npm run build` exits 0 and `node --check dist/sw.js` exits 0
- [ ] `npx vitest run` exits 0
- [ ] `test/sw-routing.test.ts` exists and its `/api/me` case asserts no
      `respondWith`
- [ ] `git status --short` shows only files listed in the Scope section
- [ ] No file listed under "Out of scope" was modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `node --check public/sw.js` still fails after your rewrite — do not add a
  build plugin to transpile it.
- `npm run build` copies something other than your `public/sw.js` to
  `dist/sw.js`.
- You find yourself wanting to add a dependency (`vite-plugin-pwa`,
  `workbox-*`). Stop and report: the zero-dependency constraint is deliberate,
  and adding a build-time SW toolchain is a product decision, not a fix.
- The SW routing test requires stubbing more of the worker environment than the
  harness above provides (for example `indexedDB`). Report what is missing
  rather than expanding the stub indefinitely.
- Making `dist/sw.js` valid requires changing `vite.config.ts`.

## Maintenance notes

- **Any future edit to `public/sw.js` must run `node --check`.** This file is
  outside `tsc`'s `include`, so nothing else will catch a syntax error, and
  `dist/` will happily ship it. Consider adding `node --check public/sw.js` to
  the CI build job as a follow-up.
- The `/api/` early-return is the security property, not an optimization. If
  someone later wants offline support for the app shell, keep `/api/`
  network-only or the per-user data leak returns.
- Cache name `pt-v2` must be bumped whenever the caching strategy changes, and
  the `activate` handler's delete-others logic depends on `CACHE` being the
  single current name. If a second cache name is ever introduced, that filter
  needs updating in the same change.
- Deferred: PNG launcher icons in `public/manifest.json` (needs 192px and
  512px raster assets) and a `purpose: "maskable"` entry. Tracked in
  `plans/README.md`'s rejected list only as a note; it is not a fix in this
  audit's queue.
