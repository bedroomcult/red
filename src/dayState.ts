import { periodDays, predictionStale, dateStale } from '../lib/cycle';
import type { Period, Prediction } from './Calendar';

// Shared day-state classification for the calendar and the week strip.
//
// Both surfaces must mark a day identically: a logged period day, a predicted
// period day, the fertile window and the ovulation peak all read the same in
// the month grid and in the home week strip. Keeping one function here is what
// stops the two from drifting apart.
export type DayState = 'logged' | 'spotting' | 'pred-period' | 'pred-ovulation' | 'pred-fertile' | '';

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const DAY = 864e5;

// Fertile window = ovulation -5d .. +1d, matching lib/cycle.ts.
const FERTILE_OFFSETS = [-5, -4, -3, -2, -1, 0, 1];

export function makeDayState({ periods, prediction, futureStarts = [], futureOv = [], periodLen = 5 }: {
  periods: Period[];
  prediction: Prediction | null;
  futureStarts?: string[];
  // Projected ovulation per future cycle, so later months show a fertile
  // window instead of only the single next one.
  futureOv?: string[];
  periodLen?: number;
}) {
  const logged = new Map(periods.map((p) => [p.start_date, p]));

  const inPeriod = new Set<string>();
  for (const p of periods) if (p.type === 'menstruation') for (const d of periodDays(p)) inPeriod.add(d);

  // Stale predictions are hidden entirely, matching the calendar's behaviour.
  // Only the single next prediction can go stale; the projections are derived
  // from the latest logged period, so they are always forward-looking.
  const stale = predictionStale(periods, prediction?.lo ?? null, prediction?.hi ?? null);
  const ovStale = dateStale(periods, prediction?.ov ?? null);
  const predLo = stale ? null : prediction?.lo ?? null;
  const predHi = stale ? null : prediction?.hi ?? null;

  // Every ovulation date we can place: the next predicted one plus each future
  // cycle's projection. Deduped, because next6Ov[0] is usually the same day as
  // prediction.ov.
  const ovDates = new Set<string>();
  if (!stale && !ovStale && prediction?.ov) ovDates.add(prediction.ov);
  for (const ov of futureOv) if (ov) ovDates.add(ov);

  const ovDays = new Set<string>(ovDates);
  const ovs = new Set<string>();
  for (const ov of ovDates) {
    const t = Date.parse(ov + 'T00:00:00Z');
    for (const o of FERTILE_OFFSETS) ovs.add(iso(t + o * DAY));
  }

  // Projected periods expand to periodLen days, so a projection reads as a
  // range rather than a single highlighted cell.
  const predDays = new Set<string>();
  for (const start of futureStarts) {
    const t0 = Date.parse(start + 'T00:00:00Z');
    for (let t = t0; t <= t0 + (periodLen - 1) * DAY; t += DAY) predDays.add(iso(t));
  }

  const state = (d: string): DayState => {
    if (inPeriod.has(d)) return 'logged';
    if (logged.has(d)) return 'spotting'; // spotting: plain number + dot
    if (predDays.has(d)) return 'pred-period';
    if (predLo && predHi && d >= predLo && d <= predHi) return 'pred-period';
    if (ovDays.has(d)) return 'pred-ovulation';
    if (ovs.has(d)) return 'pred-fertile';
    return '';
  };

  // ovs is exported so the calendar can colour the sex-log heart green on a
  // fertile day using the same window the day marks use.
  return { state, ovs };
}
