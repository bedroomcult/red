// Absolute API origin. The Android build serves the bundle from
// https://localhost, so a relative fetch('/api/me') resolved to the bundled
// index.html and every JSON.parse got "<!doctype html".
// ponytail: hardcoded, not env-configured — there is exactly one deployment.
export const API_BASE = 'https://cycle-tracker-3hg.pages.dev';

import { dateHeaders } from '../lib/today';

// Every request to our own API goes through here: absolute origin, local-date
// header, and a JSON content-type when there is a body.
//
// credentials: 'include' is required. fetch defaults to 'same-origin', so in the
// Android build (bundle on https://localhost, API on the Pages domain) the
// session cookie was set by the login response but never sent on the next
// /api/me, which returned 401 and left the user stuck on the login screen.
// On the web build the request is same-origin, so it worked there.
export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = { ...dateHeaders(), ...(init.headers as Record<string, string> | undefined) };
  if (init.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  return fetch(API_BASE + path, { credentials: 'include', ...init, headers });
}

// Read a JSON body without throwing the opaque "Unexpected token '<'" that a
// non-JSON response (an HTML error page, a captive portal) produces.
export async function readJson<T = any>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(res.ok ? 'respons' : `HTTP ${res.status}`);
  }
}
