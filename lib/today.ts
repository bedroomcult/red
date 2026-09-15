// The device's local calendar date as YYYY-MM-DD.
// ponytail: `toISOString()` renders UTC; in WIB (UTC+7) it returns yesterday's
// date until 07:00 local, so symptom and BC-dose logs landed on the wrong day.
// Build the date from the local getters instead.
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

// Headers for an /api/ request, carrying the device-local date.
export const dateHeaders = (): Record<string, string> => ({ [LOCAL_DATE_HEADER]: localDate() });
