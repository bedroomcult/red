// Cycle insights + stats for the "Wawasan" screen.
// ponytail: pure math over logged period starts, no chart lib.
import { cycleStats } from './predict';

export type Insights = {
  avgCycle: number | null;
  avgPeriod: number | null;
  variability: number | null; // stddev of cycle lengths
  count: number;
  shortest: number | null;
  longest: number | null;
  estimated: boolean; // true when the average is the fallback, not observed data
  // Projected next period starts. Six, not more: the projection compounds the
  // average cycle length, so the error grows linearly with the cycle index. By
  // cycle 7 the window is wider than a whole cycle and the date stops meaning
  // anything, so the list stops at 6.
  next6: string[];
};

const DAY = 864e5;
const parse = (d: string) => Date.parse(d + 'T00:00:00Z');
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function insights(
  periods: { start_date: string; end_date: string | null; type: string }[],
  fallbackCycle = 28,
  fallbackPeriod = 5,
  // Passed in by buildState so the estimate shown here is byte-identical to the
  // prediction window. Without it the two screens disagree on cycle length.
  statsIn?: ReturnType<typeof cycleStats>
): Insights {
  const mens = periods.filter((p) => p.type === 'menstruation').sort((a, b) => a.start_date.localeCompare(b.start_date));
  const stats = statsIn ?? cycleStats(mens.map((p) => p.start_date), fallbackCycle);

  // The same cycle list the prediction averages over: implausible entries and a
  // single >2 SD outlier already removed by cycleStats.
  const lens = stats.estimated ? [] : stats.cycles;

  const plens: number[] = [];
  for (const p of mens) {
    if (p.end_date) plens.push(Math.round((parse(p.end_date) - parse(p.start_date)) / DAY) + 1);
  }

  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const avgCycle = lens.length ? Math.round(stats.avg) : null;
  const avgPeriod = plens.length ? Math.round(mean(plens)) : null;
  const variability = lens.length >= 2 ? Math.round(stats.sd * 10) / 10 : null;

  const eff = avgCycle ?? stats.fb;
  // Fall back to the configured length for the projection when there is not
  // enough data — the same thing predict() does, so next6[0] === prediction.next.
  const last = stats.last;
  const next6: string[] = [];
  if (last !== null) for (let i = 1; i <= 6; i++) next6.push(iso(last + eff * i * DAY));

  return {
    avgCycle,
    avgPeriod,
    variability,
    count: lens.length,
    shortest: lens.length ? Math.min(...lens) : null,
    longest: lens.length ? Math.max(...lens) : null,
    estimated: stats.estimated,
    next6,
  };
}

// ponytail: assert self-check. `node --experimental-strip-types lib/insights.ts`
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('insights.ts')) {
  const p = [
    { start_date: '2026-01-01', end_date: '2026-01-05', type: 'menstruation' },
    { start_date: '2026-01-29', end_date: '2026-02-02', type: 'menstruation' },
    { start_date: '2026-02-26', end_date: '2026-03-02', type: 'menstruation' },
  ];
  const r = insights(p);
  console.assert(r.avgCycle === 28, 'avgCycle ' + r.avgCycle);
  console.assert(r.avgPeriod === 5, 'avgPeriod ' + r.avgPeriod);
  console.assert(r.count === 2, 'count');
  console.assert(r.next6.length === 6 && r.next6[0] === '2026-03-26', 'next6 ' + r.next6[0]);
  console.assert(insights([]).avgCycle === null, 'empty');
  console.log('insights.ts self-check passed');
}
