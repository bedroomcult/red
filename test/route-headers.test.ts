import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsonResponse, SECURITY_HEADERS } from '../functions/_lib';

const here = dirname(fileURLToPath(import.meta.url));
const apiDir = join(here, '..', 'functions', 'api');

// Plan 004 added headers to auth.ts only. A route that hand-rolls a Response
// silently ships without them, and nothing in the suite noticed. This guard
// reads the route sources so a new endpoint cannot regress it.
describe('every API route uses the shared json helper', () => {
  const files = readdirSync(apiDir).filter((f) => f.endsWith('.ts'));

  it('finds the route files', () => {
    expect(files.length).toBeGreaterThanOrEqual(8);
  });

  for (const f of files) {
    it(`${f} does not construct a JSON Response directly`, () => {
      const src = readFileSync(join(apiDir, f), 'utf8');
      expect(src).not.toMatch(/new Response\(\s*JSON\.stringify/);
    });
  }

  it('jsonResponse sets every security header', async () => {
    const res = jsonResponse({ ok: true });
    expect(res.headers.get('Content-Type')).toBe('application/json');
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
      expect(res.headers.get(k)).toBe(v);
    }
  });

  it('jsonResponse preserves status, extra headers and a Set-Cookie', async () => {
    const res = jsonResponse({}, 401, { 'Set-Cookie': 'sess=; Max-Age=0' });
    expect(res.status).toBe(401);
    expect(res.headers.get('Set-Cookie')).toBe('sess=; Max-Age=0');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(await res.json()).toEqual({});
  });
});
