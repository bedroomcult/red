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

// Fertile window = ovulation -5d .. +1d, matching lib/cycle.ts.
function ovSet(ov: string | null): Set<string> {
  if (!ov) return new Set();
  const t = Date.parse(ov + 'T00:00:00Z');
  return new Set([-5, -4, -3, -2, -1, 0, 1].map((o) => iso(t + o * 864e5)));
}

export function makeDayState({ periods, prediction, futureStarts = [], periodLen = 5 }: {
  periods: Period[];
  prediction: Prediction | null;
  futureStarts?: string[];
  periodLen?: number;
}) {
  const logged = new Map(periods.map((p) => [p.start_date, p]));

  const inPeriod = new Set<string>();
  for (const p of periods) if (p.type === 'menstruation') for (const d of periodDays(p)) inPeriod.add(d);

  // Stale predictions are hidden entirely, matching the calendar's behaviour.
  const stale = predictionStale(periods, prediction?.lo ?? null, prediction?.hi ?? null);
  const ovStale = dateStale(periods, prediction?.ov ?? null);
  const ovs = stale || ovStale ? new Set<string>() : ovSet(prediction?.ov ?? null);
  const ovDay = stale || ovStale ? null : prediction?.ov ?? null;
  const predLo = stale ? null : prediction?.lo ?? null;
  const predHi = stale ? null : prediction?.hi ?? null;

  // Projected periods expand to periodLen days, so a projection reads as a
  // range rather than a single highlighted cell.
  const predDays = new Set<string>();
  for (const start of futureStarts) {
    for (let t = Date.parse(start + 'T00:00:00Z'); t <= Date.parse(start + 'T00:00:00Z') + (periodLen - 1) * 864e5; t += 864e5) {
      predDays.add(iso(t));
    }
  }

  return function dayState(d: string): DayState {
    if (inPeriod.has(d)) return 'logged';
    if (logged.has(d)) return 'spotting'; // spotting: plain number + dot
    if (predDays.has(d)) return 'pred-period';
    if (predLo && predHi && d >= predLo && d <= predHi) return 'pred-period';
    if (d === ovDay) return 'pred-ovulation';
    if (ovs.has(d)) return 'pred-fertile';
    return '';
  };
}
