// Date validation shared by the API routes.
//
// Date.parse alone is not enough: it rolls impossible dates over rather than
// rejecting them, so Date.parse('2026-02-31T00:00:00Z') is March 3 and a naive
// check accepts it. Round-tripping the timestamp back to a string catches that.
export function isIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const t = Date.parse(s + 'T00:00:00Z');
  if (Number.isNaN(t)) return false;
  return new Date(t).toISOString().slice(0, 10) === s;
}
