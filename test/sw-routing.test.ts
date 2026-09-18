import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// The service worker once shipped a TypeScript `as any` cast into public/sw.js.
// Vite copies public/ verbatim, so the browser refused to parse it and
// registration failed silently. These tests load the real source and assert the
// routing decisions — in particular that /api/ is never cached, because a
// cached /api/me would serve one user's cycle data to the next person.
const SRC = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

function loadWorker() {
  const listeners: Record<string, (e: any) => void> = {};
  const cachedUrls: string[] = [];

  const self: any = {
    location: { origin: 'https://app.test' },
    addEventListener: (name: string, fn: any) => {
      listeners[name] = fn;
    },
    skipWaiting: () => {},
    clients: { claim: () => {} },
  };

  const ctx: any = {
    self,
    caches: {
      open: async () => ({
        match: async () => null,
        put: async (r: any) => {
          cachedUrls.push(typeof r === 'string' ? r : r.url);
        },
      }),
      keys: async () => ['pt-v1', 'pt-v2', 'pt-v3', 'pt-v4', 'pt-v5', 'pt-v6', 'pt-v7', 'pt-v8', 'pt-v9', 'pt-v10', 'pt-v11', 'pt-v12', 'pt-v13', 'pt-v14', 'pt-v15'],
      delete: async () => true,
    },
    fetch: async () => new Response('ok', { status: 200 }),
    URL,
    Response,
    Promise,
    console,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return { listeners, cachedUrls };
}

async function route(method: string, url: string) {
  const { listeners, cachedUrls } = loadWorker();
  let claimed = false;
  const event = {
    request: new Request(url, { method }),
    respondWith: () => {
      claimed = true;
    },
  };
  await listeners.fetch(event);
  // Flush the microtask queue so any cache.put inside the respondWith promise
  // settles before we assert.
  await new Promise((r) => setTimeout(r, 0));
  return { claimed, cachedUrls };
}

describe('public/sw.js routing', () => {
  it('is valid JavaScript (no TypeScript casts)', () => {
    expect(SRC).not.toMatch(/\bas any\b/);
    expect(() => new vm.Script(SRC)).not.toThrow();
  });

  it('does not intercept GET /api/me', async () => {
    const { claimed } = await route('GET', 'https://app.test/api/me');
    expect(claimed).toBe(false);
  });

  it('does not intercept POST /api/periods', async () => {
    const { claimed } = await route('POST', 'https://app.test/api/periods');
    expect(claimed).toBe(false);
  });

  it('intercepts same-origin static assets', async () => {
    const { claimed } = await route('GET', 'https://app.test/assets/index-abc.js');
    expect(claimed).toBe(true);
  });

  it('intercepts same-origin navigations', async () => {
    const { claimed } = await route('GET', 'https://app.test/');
    expect(claimed).toBe(true);
  });

  it('does not intercept cross-origin requests', async () => {
    const { claimed } = await route('GET', 'https://other.test/api/me');
    expect(claimed).toBe(false);
  });

  it('never writes an /api/ url into the cache', async () => {
    const { listeners, cachedUrls } = loadWorker();
    for (const [method, url] of [
      ['GET', 'https://app.test/api/me'],
      ['GET', 'https://app.test/api/periods'],
      ['GET', 'https://app.test/assets/x.js'],
    ] as const) {
      await listeners.fetch({ request: new Request(url, { method }), respondWith: () => {} });
    }
    await new Promise((r) => setTimeout(r, 0));
    expect(cachedUrls.some((u) => u.includes('/api/'))).toBe(false);
  });
});

// In the APK the bundle is served from https://localhost, so requests to the API
// origin are cross-origin. The worker must leave them alone: the CORS headers
// come from the network, and a cached response would lack them.
describe('public/sw.js with the Capacitor origin', () => {
  it('does not intercept a cross-origin API call from the app', async () => {
    const { claimed } = await route('GET', 'https://cycle-tracker-3hg.pages.dev/api/me');
    expect(claimed).toBe(false);
  });

  it('does not intercept a cross-origin API POST from the app', async () => {
    const { claimed } = await route('POST', 'https://cycle-tracker-3hg.pages.dev/api/periods');
    expect(claimed).toBe(false);
  });
});
