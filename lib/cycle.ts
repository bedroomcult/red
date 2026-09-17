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

// An ongoing period (end_date null) has no known length. Painting it with the
// user's period_len gives a bounded, honest guess; the UI then asks whether it
// is still going instead of either truncating a long bleed or painting forever.
// `today` bounds the guess so a period started weeks ago is not painted past
// today.
export function ongoingPeriodDays(
  p: { start_date: string; end_date: string | null },
  periodLen: number,
  today: string
): string[] {
  const s = parse(p.start_date);
  const byLen = s + (periodLen - 1) * DAY;
  const t = parse(today);
  const e = Math.min(byLen, t);
  const out: string[] = [];
  for (let d = s; d <= e; d += DAY) out.push(iso(d));
  return out;
}

// Two bleeds within this many days are treated as one episode, so logging a new
// start during (or right after) an ongoing period extends it rather than
// creating a second row. Two rows would paint overlapping blocks, reset the
// cycle-day counter mid-bleed, and split one episode across the history.
// ponytail: fixed gap, not user-configurable — 2 days catches a one-day pause
// without swallowing a genuinely separate episode.
export const MERGE_GAP_DAYS = 2;

// The logged period a new start date should extend, if any. Only an ongoing
// period (no end_date) whose range reaches within MERGE_GAP_DAYS of the new
// start qualifies; a finished period followed by a new bleed is a new cycle.
export function periodToExtend<T extends { start_date: string; end_date: string | null; type: string }>(
  periods: T[],
  startDate: string,
  periodLen: number
): T | undefined {
  const s = parse(startDate);
  return periods.find((p) => {
    if (p.type !== 'menstruation') return false;
    if (p.end_date) return false;
    const ps = parse(p.start_date);
    if (s < ps) return false;
    // End of the expected range. A start inside the range gives a negative gap,
    // which is still <= the threshold, so it merges too.
    const paintedEnd = ps + (periodLen - 1) * DAY;
    const gap = Math.round((s - paintedEnd) / DAY);
    return gap <= MERGE_GAP_DAYS;
  });
}

// True when an ongoing period has reached its expected length and the user has
// not confirmed the end. The UI prompts on this.
export function needsEndPrompt(
  p: { start_date: string; end_date: string | null },
  periodLen: number,
  today: string
): boolean {
  if (p.end_date) return false;
  const elapsed = Math.round((parse(today) - parse(p.start_date)) / DAY) + 1;
  return elapsed >= periodLen;
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

export function cycleStatus(today: string, periodStarts: string[], periodRanges: { start_date: string; end_date: string | null }[], prediction: { next: string | null; ov: string | null; confidence: string } | null, bcMode: boolean, periodLen = 5): CycleStatus {
  if (bcMode) return { phase: 'bc', cycleDay: null, daysToNext: null, ov: null };

  const t = parse(today);
  // Last period start at or before today.
  const past = periodStarts.filter((s) => parse(s) <= t).sort();
  const last = past.length ? past[past.length - 1] : null;
  const cycleDay = last ? Math.floor((t - parse(last)) / DAY) + 1 : null;

  // In a logged period range? An ongoing period uses the user's period_len, and
  // is bounded by today, rather than the old hardcoded 5 days.
  for (const r of periodRanges) {
    const days = r.end_date
      ? periodDays({ start_date: r.start_date, end_date: r.end_date })
      : ongoingPeriodDays({ start_date: r.start_date, end_date: null }, periodLen, today);
    if (days.includes(today)) return { phase: 'period', cycleDay, daysToNext: null, ov: prediction?.ov ?? null };
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

// ponytail: assert-based self-check for the ongoing-period helpers, run with
// `node --experimental-strip-types lib/cycle.ts`.
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('cycle.ts')) {
  const D = (d: string) => d;
  // ongoingPeriodDays is bounded by period_len and by today.
  console.assert(ongoingPeriodDays({ start_date: '2026-09-01', end_date: null }, 5, '2026-09-20').length === 5, 'len cap');
  console.assert(ongoingPeriodDays({ start_date: '2026-09-01', end_date: null }, 5, '2026-09-03').length === 3, 'today cap');
  console.assert(ongoingPeriodDays({ start_date: '2026-09-01', end_date: null }, 5, '2026-09-20').at(-1) === '2026-09-05', 'last day');
  // needsEndPrompt fires exactly at period_len.
  console.assert(needsEndPrompt({ start_date: '2026-09-01', end_date: null }, 5, '2026-09-04') === false, 'before');
  console.assert(needsEndPrompt({ start_date: '2026-09-01', end_date: null }, 5, '2026-09-05') === true, 'at');
  console.assert(needsEndPrompt({ start_date: '2026-09-01', end_date: '2026-09-05' }, 5, '2026-09-20') === false, 'closed');
  // periodToExtend merges a nearby start into an ongoing period.
  const p = [{ start_date: '2026-09-01', end_date: null, type: 'menstruation' }];
  console.assert(periodToExtend(p, '2026-09-03', 5)?.start_date === '2026-09-01', 'merge inside');
  console.assert(periodToExtend(p, '2026-09-07', 5)?.start_date === '2026-09-01', 'merge gap');
  console.assert(periodToExtend(p, '2026-09-08', 5) === undefined, 'too far');
  console.assert(periodToExtend([{ start_date: '2026-09-01', end_date: '2026-09-05', type: 'menstruation' }], '2026-09-07', 5) === undefined, 'closed not merged');
  console.log('ongoing-period self-check passed');
}
