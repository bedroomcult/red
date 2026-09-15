// Copy of lib/today.ts for Pages Functions (functions/ must be self-contained —
// the Pages bundler does not resolve imports outside functions/, same reason
// _predict.ts exists).
// ponytail: keep in sync with lib/today.ts.
export const LOCAL_DATE_HEADER = 'X-Local-Date';

export function localDate(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// A valid YYYY-MM-DD that is a real calendar date (rejects 2026-02-31).
export function isIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(s + 'T00:00:00Z');
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s;
}

// The client sends its device-local date so a WIB user logging at 00:30 is not
// recorded on yesterday's UTC date. Absent or malformed -> UTC (curl, old clients).
export function clientDate(request: Request): string {
  const raw = request.headers.get(LOCAL_DATE_HEADER);
  return isIsoDate(raw) ? raw : new Date().toISOString().slice(0, 10);
}
