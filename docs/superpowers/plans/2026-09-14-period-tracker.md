# Period Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship multi-user period tracker MVP with mode-aware predictions + calendar UI.

**Architecture:** Pages static Vite+React+shadcn frontend, Pages Functions `/api/*` JSON API, D1 storage, prediction as pure `lib/predict.ts` shared client/server.

**Tech Stack:** Vite React TS, Tailwind + shadcn/ui, Cloudflare Pages Functions, D1, WebCrypto scrypt-ish (pbkdf2), Vitest.

**Spec:** docs/superpowers/specs/2026-09-14-period-tracker-design.md

## Global Constraints
- UTC date-only strings `YYYY-MM-DD` stored, local render.
- Red hollow=predicted period, green hollow=predicted ovulation, solid+✓=logged.
- Fallback: no log = stays prediction; auto-confirm only after expected+7d (+10d EC).
- Medical footer disclaimer on EC/fertile screens.
- No reminders cron, no BBT/LH charts v1.
---

### Task 1: Scaffold + DB + predict lib

**Files:**
- Create: `package.json`, `vite.config.ts`, `migrations/0001_init.sql`, `lib/predict.ts`, `lib/predict.test.ts`
- Modify: `.gitignore` (add `.superpowers/`)

**Interfaces:**
- Consumes: none
- Produces: `predict(starts: string[], opts: {ecType?: 'LNG'|'UPA'|null, bcMode?: boolean}) => {next: string|null, lo: string|null, hi: string|null, ov: string|null, confidence: 'high'|'med'|'low'|'suppressed', flags: string[]}`

- [ ] **Step 1: Write failing test**

```ts
// lib/predict.test.ts
import { describe, it, expect } from 'vitest';
import { predict } from './predict';
describe('predict', () => {
  it('avgs 28,28,31 -> next Apr27 window ±2 high', () => {
    const r = predict(['2026-01-01','2026-01-29','2026-02-26','2026-03-29'], {});
    expect(r.next).toBe('2026-04-27');
    expect(r.confidence).toBe('high');
  });
});
```

- [ ] **Step 2: Run test, verify fails**

Run: `npx vitest run lib/predict.test.ts`
Expected: FAIL missing module

- [ ] **Step 3: Minimal predict impl**

```ts
// lib/predict.ts
export function predict(starts: string[], opts: {ecType?: string|null, bcMode?: boolean}) {
  if (opts.bcMode) return { next: null, lo: null, hi: null, ov: null, confidence: 'suppressed' as const, flags: ['bc-suppressed'] };
  const ds = starts.map(s => Date.parse(s+'T00:00:00Z'));
  if (ds.length < 2) return { next: null, lo: null, hi: null, ov: null, confidence: 'low' as const, flags: ['need-more-data'] };
  let cycles: number[] = [];
  for (let i=1;i<ds.length;i++) cycles.push(Math.round((ds[i]-ds[i-1])/86400000));
  cycles = cycles.slice(-6);
  const mean = (a:number[])=>a.reduce((x,y)=>x+y,0)/a.length;
  let avg = mean(cycles);
  let sd = Math.sqrt(mean(cycles.map(c=>(c-avg)**2)));
  if (cycles.length>=4) { const out = cycles.filter(c=>Math.abs(c-avg)>2*sd); if (out.length===1) { cycles = cycles.filter(c=>c!==out[0]); avg = mean(cycles); sd = Math.sqrt(mean(cycles.map(c=>(c-avg)**2))); } }
  const last = ds[ds.length-1];
  const next = new Date(last + Math.round(avg)*86400000).toISOString().slice(0,10);
  let w = Math.max(Math.round(sd),2);
  if (opts.ecType==='LNG') w = 7;
  if (opts.ecType==='UPA') w = 10;
  const lo = new Date(Date.parse(next)-w*86400000).toISOString().slice(0,10);
  const hi = new Date(Date.parse(next)+w*86400000).toISOString().slice(0,10);
  const ov = opts.ecType ? null : new Date(Date.parse(next)-14*86400000).toISOString().slice(0,10);
  const confidence = (opts.ecType?'low':sd<2?'high':sd<4?'med':'low') as any;
  const flags:string[] = [];
  const range = Math.max(...cycles)-Math.min(...cycles);
  if (range>9) flags.push('irregular');
  if (opts.ecType) flags.push('ec-disrupted');
  return { next, lo, hi, ov, confidence, flags };
}
```

- [ ] **Step 4: Run tests pass**

Run: `npx vitest run lib/predict.test.ts`
Expected: PASS

- [ ] **Step 5: Scaffold vite + migrations**

```sql
-- migrations/0001_init.sql
CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, pass_hash TEXT NOT NULL, salt TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL);
CREATE TABLE periods (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT, flow TEXT, type TEXT NOT NULL DEFAULT 'menstruation');
CREATE TABLE pill_regimens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, pill_type TEXT NOT NULL, regimen TEXT NOT NULL, pack_start_date TEXT NOT NULL);
CREATE TABLE dose_logs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, date TEXT NOT NULL, taken INTEGER NOT NULL);
CREATE TABLE ec_events (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, ec_type TEXT NOT NULL, intake_at TEXT NOT NULL, upsi_at TEXT);
```

Run: `npm init -y; npm i react react-dom; npm i -D vite @vitejs/plugin-react vitest typescript`
Expected: files exist

- [ ] **Step 6: Commit**

```bash
git add package.json lib migrations vite.config.ts
git commit -m "feat: predict lib + scaffold + D1 schema"
```

### Task 2: Auth API (simple D1 auth)

**Files:**
- Create: `functions/api/auth.ts`, `functions/_lib.ts`
- Test: `curl` signup/login manually

**Interfaces:**
- Consumes: D1 binding `DB`
- Produces: `POST /api/auth {action:'signup'|'login'|'logout', email, password}` sets HttpOnly cookie `sess`

- [ ] **Step 1: Write _lib helpers**

```ts
// functions/_lib.ts
export async function hashPw(pw: string, salt: string) {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 50000, hash: 'SHA-256' }, km, 256);
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}
export function uid() { return crypto.randomUUID(); }
```

- [ ] **Step 2: Write auth endpoint**

```ts
// functions/api/auth.ts (Pages Functions, D1 via env.DB)
export async function onRequestPost({ request, env }: any) {
  const { action, email, password } = await request.json();
  if (action === 'signup') {
    const salt = crypto.randomUUID(); const { hashPw, uid } = await import('../_lib');
    const pass_hash = await hashPw(password, salt);
    const id = uid();
    await env.DB.prepare('INSERT INTO users VALUES (?,?,?,?,?)').bind(id, email, pass_hash, salt, new Date().toISOString()).run();
    const token = uid();
    await env.DB.prepare('INSERT INTO sessions VALUES (?,?,?)').bind(token, id, new Date(Date.now()+30*864e5).toISOString()).run();
    return new Response('{}', { headers: { 'Set-Cookie': `sess=${token}; HttpOnly; Path=/; Max-Age=2592000; SameSite=Lax; Secure` } });
  }
  // login: lookup, compare hash, issue token; logout: delete token. Rate-limit: return 429 if >10 attempts/10min per IP (skip store v1, in-memory map).
  return new Response('{}');
}
```

- [ ] **Step 3: Smoke test**

Run: `npx wrangler pages dev --d1 DB=period-db 2>&1 | head`
Expected: serves

- [ ] **Step 4: Commit**

```bash
git add functions/
git commit -m "feat: simple D1 auth"
```

### Task 3: Periods + EC + BC APIs + predict wiring

**Files:**
- Create: `functions/api/periods.ts`, `functions/api/ec.ts`, `functions/api/bc.ts`, `functions/api/me.ts`

**Interfaces:**
- Consumes: sessions cookie, `predict()` ported inline (import from `../../../lib/predict`)
- Produces: `GET /api/me -> {periods, prediction, bc, ec}`

- [ ] **Step 1: Write me endpoint**

```ts
// functions/api/me.ts
// 1. read sess cookie, lookup sessions+user, 401 if missing
// 2. select periods where user_id order by start_date, pill_regimens latest, ec_events latest 60d
// 3. filter starts type=menstruation for predict, pass ecType if ec within 60d, bcMode if regimen active
// 4. return JSON {periods, prediction}
```

- [ ] **Step 2: Write periods/ec/bc POST endpoints (insert + return recalc)**

- [ ] **Step 3: Commit**

```bash
git add functions/api/
git commit -m "feat: cycle APIs + prediction wiring"
```

### Task 4: Calendar UI (red/green circles + log sheet)

**Files:**
- Create: `src/App.tsx`, `src/Calendar.tsx`, `src/LogSheet.tsx`, `index.html`

**Interfaces:**
- Consumes: `GET /api/me`
- Produces: month grid, tap-to-log, fallback hollow→solid

- [ ] **Step 1: Write Calendar grid**

```tsx
// src/Calendar.tsx — month grid, Mon-start
// props: {month, periods, prediction:{next,lo,hi,ov}}
// day class: in [lo..hi] → red hollow (2px #e5484d rounded-full); ov±1 → green hollow; logged start → red solid + ✓; spotting → grey dot
```

- [ ] **Step 2: Write LogSheet + App fetch**

```tsx
// tap day → sheet with buttons: Log period / spotting / Confirm / Edit / Skip → POST /api/periods → refetch /api/me
// no action = hollow stays; after expected+7d server auto-keeps prediction
```

- [ ] **Step 3: Add shadcn button/dialog minimal (copy 2 components, no full CLI)**

- [ ] **Step 4: Commit**

```bash
git add src/ index.html
git commit -m "feat: calendar UI red/green + log sheet"
```

### Task 5: Banners, history, disclaimers, deploy check

**Files:**
- Modify: `src/App.tsx`
- Create: `wrangler.toml`, `README.md`

- [ ] **Step 1: Banners + history list + footer disclaimer**

```tsx
// if bcMode → amber banner "BC-suppressed…"; if ec-disrupted → yellow banner + test guidance; footer: "General info only, not medical advice."
```

- [ ] **Step 2: Deploy dry-run**

Run: `npx wrangler pages deploy dist --dry-run 2>&1 | head`
Expected: no error (or wrangler login hint)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: banners + history + deploy config"
```

### Task 6: Installable Android (Capacitor + PWA, Orion-Store pattern)

**Files:**
- Create: `manifest.json`, `capacitor.config.ts`, `public/icon.svg`
- Modify: `index.html` (viewport-fit, theme-color, manifest link), `package.json` (deps)

**Interfaces:**
- Consumes: `dist/` web build as Capacitor `webDir`
- Produces: installable PWA + `npx cap add android` ready project

- [ ] **Step 1: Add Capacitor deps**

Run: `npm i @capacitor/core @capacitor/android @capacitor/app @capacitor/status-bar @capacitor/splash-screen @capacitor/local-notifications @capacitor/haptics`
Expected: package.json updated

- [ ] **Step 2: manifest + config (mirror Orion-Store)**

```json
// manifest.json
{
  "name": "Cycle Tracker",
  "short_name": "Cycle",
  "start_url": ".",
  "display": "standalone",
  "background_color": "#fff1f2",
  "theme_color": "#e5484d",
  "orientation": "portrait",
  "icons": [{ "src": "./icon.png", "sizes": "512x512", "type": "image/png" }]
}
```

```ts
// capacitor.config.ts
import { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.cycle.tracker',
  appName: 'Cycle Tracker',
  webDir: 'dist',
  server: { androidScheme: 'https' },
  plugins: { StatusBar: { style: 'LIGHT' } }
};
export default config;
```

- [ ] **Step 3: index.html mobile shell**

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover" />
<meta name="theme-color" content="#e5484d" />
<link rel="manifest" href="/manifest.json" />
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: capacitor android + PWA installable"
```

### Task 7: GitHub CI build + deploy Pages

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: repo secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, D1 `DB` binding
- Produces: CI green → Pages deployed, D1 migrated

- [ ] **Step 1: Write workflow**

```yaml
# .github/workflows/ci.yml
name: ci
on:
  push:
    branches: [main]
  pull_request:
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx vitest run
      - run: npm run build
  deploy:
    if: github.ref == 'refs/heads/main'
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci && npm run build
      - run: npx wrangler d1 migrations apply period-db --remote
        env: { CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}, CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }} }
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name cycle-tracker
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: build test deploy pages + D1"
```
