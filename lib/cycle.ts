// Cycle phase for the glance/home screen.
// ponytail: pure date math on YYYY-MM-DD UTC strings, no date lib.

export type Phase = 'period' | 'fertile' | 'ovulation' | 'pms' | 'neutral' | 'bc';

export type CycleStatus = {
  phase: Phase;
  cycleDay: number | null;   // day 1 = first day of last logged period
  daysToNext: number | null; // days until predicted next period
  ov: string | null;
};

const DAY = 864e5;
const parse = (d: string) => Date.parse(d + 'T00:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

// Full range (inclusive) of a logged period: start..end, or start+defaultDays-1.
export function periodDays(p: { start_date: string; end_date: string | null }, defaultDays = 5): string[] {
  const s = parse(p.start_date);
  const e = p.end_date ? parse(p.end_date) : s + (defaultDays - 1) * DAY;
  const out: string[] = [];
  for (let t = s; t <= e; t += DAY) out.push(iso(t));
  return out;
}

// Logged period whose range (start..end, or start+defaultDays-1) contains date.
// Shared by the day sheet, the log sheet and the calendar so all three agree on
// what "this day is inside a period" means.
export function periodForDate<T extends { start_date: string; end_date: string | null; type: string }>(
  periods: T[],
  date: string,
  defaultDays = 5
): T | undefined {
  return periods.find((p) => p.type === 'menstruation' && periodDays(p, defaultDays).includes(date));
}

// A predicted period window is stale when a real logged period overlaps it, or
// the window lies entirely before the latest logged period. Whole window hides.
export function predictionStale(
  periods: { start_date: string; end_date: string | null; type: string }[],
  lo: string | null,
  hi: string | null
): boolean {
  const mens = periods.filter((p) => p.type === 'menstruation');
  if (!mens.length) return false;
  const loggedDays = new Set(mens.flatMap((p) => periodDays(p)));
  const lastStart = mens.reduce((m, p) => (p.start_date > m ? p.start_date : m), mens[0].start_date);
  if (hi && hi < lastStart) return true;
  if (!lo || !hi) return false;
  for (let t = parse(lo); t <= parse(hi); t += DAY) if (loggedDays.has(iso(t))) return true;
  return false;
}

// Single predicted date (ovulation): stale only when it lies before the latest
// logged period start. Overlap with a logged period is NOT enough to hide it —
// a short cycle legitimately puts ovulation near the period, and hiding it left
// users with no fertile window at all.
export function dateStale(
  periods: { start_date: string; type: string }[],
  date: string | null
): boolean {
  if (!date) return false;
  const mens = periods.filter((p) => p.type === 'menstruation');
  if (!mens.length) return false;
  const lastStart = mens.reduce((m, p) => (p.start_date > m ? p.start_date : m), mens[0].start_date);
  return date < lastStart;
}

export function cycleStatus(today: string, periodStarts: string[], periodRanges: { start_date: string; end_date: string | null }[], prediction: { next: string | null; ov: string | null; confidence: string } | null, bcMode: boolean): CycleStatus {
  if (bcMode) return { phase: 'bc', cycleDay: null, daysToNext: null, ov: null };

  const t = parse(today);
  // Last period start at or before today.
  const past = periodStarts.filter((s) => parse(s) <= t).sort();
  const last = past.length ? past[past.length - 1] : null;
  const cycleDay = last ? Math.floor((t - parse(last)) / DAY) + 1 : null;

  // In a logged period range? (start .. end, default 5 days if no end yet)
  for (const r of periodRanges) {
    const s = parse(r.start_date);
    const e = r.end_date ? parse(r.end_date) : s + 4 * DAY;
    if (t >= s && t <= e) return { phase: 'period', cycleDay, daysToNext: null, ov: prediction?.ov ?? null };
  }

  const ov = prediction?.ov ?? null;
  const daysToNext = prediction?.next ? Math.round((parse(prediction.next) - t) / DAY) : null;

  if (ov) {
    const o = parse(ov);
    if (t === o) return { phase: 'ovulation', cycleDay, daysToNext, ov };
    if (t >= o - 5 * DAY && t <= o + DAY) return { phase: 'fertile', cycleDay, daysToNext, ov };
  }

  // PMS = last 4 days before predicted period.
  if (daysToNext !== null && daysToNext <= 4 && daysToNext >= 0) return { phase: 'pms', cycleDay, daysToNext, ov };

  return { phase: 'neutral', cycleDay, daysToNext, ov };
}

// ponytail: assert-based self-check, run with `node --experimental-strip-types lib/cycle.ts`.
// Guarded so the browser bundle (which has no `process`) never evaluates it.
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('cycle.ts')) {
  const p = [{ start_date: '2026-01-01', end_date: '2026-01-05' }];
  const starts = ['2026-01-01'];
  const pred = { next: '2026-01-29', ov: '2026-01-15', confidence: 'high' };
  console.assert(cycleStatus('2026-01-03', starts, p, pred, false).phase === 'period', 'period day');
  console.assert(cycleStatus('2026-01-15', starts, p, pred, false).phase === 'ovulation', 'ov day');
  console.assert(cycleStatus('2026-01-12', starts, p, pred, false).phase === 'fertile', 'fertile');
  console.assert(cycleStatus('2026-01-27', starts, p, pred, false).phase === 'pms', 'pms');
  console.assert(cycleStatus('2026-01-20', starts, p, pred, false).phase === 'neutral', 'neutral');
  console.assert(cycleStatus('2026-01-20', starts, p, pred, true).phase === 'bc', 'bc');
  console.assert(cycleStatus('2026-01-03', starts, p, pred, false).cycleDay === 3, 'cycleDay');

  // predictionStale: predicted 3-10, logged 1-7 => stale (8-10 must hide too).
  const logged17 = [{ start_date: '2026-01-01', end_date: '2026-01-07', type: 'menstruation' }];
  console.assert(predictionStale(logged17, '2026-01-03', '2026-01-10') === true, 'overlap stale');
  console.assert(predictionStale(logged17, '2026-01-20', '2026-01-27') === false, 'future not stale');
  console.assert(predictionStale(logged17, '2025-12-20', '2025-12-27') === true, 'behind last stale');
  console.assert(predictionStale([], '2026-01-03', '2026-01-10') === false, 'no logs not stale');
  console.assert(periodDays({ start_date: '2026-01-01', end_date: '2026-01-03' }).length === 3, 'periodDays');

  console.log('cycle.ts self-check passed');
}
