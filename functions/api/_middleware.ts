// CORS for the Android build. The APK serves the bundle from
// https://localhost, so every /api/* call is cross-origin and the browser
// withholds a SameSite=Lax cookie. This middleware allows the app origins and
// handles the preflight that Content-Type: application/json and X-Local-Date
// trigger.
//
// Security: only the listed origins are echoed back, and never with `*`, so a
// random site cannot read API responses or send credentialed POSTs (the
// preflight would fail). The session cookie stays HttpOnly.
import { SECURITY_HEADERS } from '../_lib';

const ALLOWED = new Set([
  'https://localhost', // Capacitor Android, androidScheme: 'https'
  'capacitor://localhost', // Capacitor iOS
  'http://localhost', // plain dev server
  'https://cycle-tracker-3hg.pages.dev', // the web app itself
]);

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED.has(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Local-Date',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

export async function onRequest(context: any) {
  const { request, next } = context;
  const cors = corsHeaders(request.headers.get('Origin'));

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...cors, ...SECURITY_HEADERS } });
  }

  const res = await next();
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors)) h.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}
