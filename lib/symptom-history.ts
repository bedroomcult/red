// Symptom history for the "Wawasan" screen and the day sheet.
//
// Symptoms were stored from the start but only ever read back for *today*
// (buildState filtered on `date = today`), so a logged symptom became invisible
// the next morning. This turns the stored rows into something readable: how
// often each kind occurs, and which cycle phase it clusters in.
//
// ponytail: pure math over logged rows, no chart lib. Phase attribution reuses
// cycleStatus, so a symptom is attributed by the same rule the calendar paints.

import { cycleStatus } from './cycle';

export type SymptomRow = { date: string; kind: string };

// Phase names, kept as plain strings so lib/ stays free of the UI's i18n map.
// Exported so consumers (the day sheet, the insights screen) can index their own
// phase label maps without a widening cast.
export const SYMPTOM_PHASES = ['period', 'fertile', 'ovulation', 'pms', 'neutral', 'bc'] as const;
export type SymptomPhase = (typeof SYMPTOM_PHASES)[number];

export type SymptomStat = {
  kind: string;
  count: number;
  // Most frequent phase for this kind, or null when the counts are too thin or
  // the phase never repeats. Null is shown as "not enough data", never guessed.
  topPhase: SymptomPhase | null;
  topPhaseCount: number;
};

export type SymptomHistory = {
  total: number;
  days: number; // distinct dates with at least one symptom
  first: string | null;
  last: string | null;
  stats: SymptomStat[];
  // Counts per phase across all symptoms, so the screen can show where the
  // symptoms land overall rather than only per kind.
  byPhase: Record<string, number>;
  // Distinct dates per phase, for a rate that is not skewed by one heavy day.
  daysByPhase: Record<string, number>;
};

export function symptomHistory(
  rows: SymptomRow[],
  periods: { start_date: string; end_date: string | null; type: string }[],
  prediction: { next: string | null; ov: string | null; confidence?: string } | null,
  bcMode = false,
  periodLen = 5
): SymptomHistory {
  if (!rows.length) {
    return { total: 0, days: 0, first: null, last: null, stats: [], byPhase: {}, daysByPhase: {} };
  }

  const starts = periods.filter((p) => p.type === 'menstruation').map((p) => p.start_date);
  const ranges = periods
    .filter((p) => p.type === 'menstruation')
    .map((p) => ({ start_date: p.start_date, end_date: p.end_date }));

  // cycleStatus only needs next, ov and confidence; the client's Prediction also
  // carries lo/hi/flags, which are irrelevant here.
  const pred = prediction
    ? { next: prediction.next, ov: prediction.ov, confidence: prediction.confidence ?? 'med' }
    : null;

  const dates = [...new Set(rows.map((r) => r.date))].sort();
  const phaseOf = new Map<string, SymptomPhase>();
  for (const d of dates) {
    phaseOf.set(d, cycleStatus(d, starts, ranges, pred, bcMode, periodLen).phase);
  }

  const perKind = new Map<string, Map<SymptomPhase, number>>();
  const byPhase: Record<string, number> = {};
  const daysByPhase: Record<string, number> = {};
  for (const r of rows) {
    const ph = phaseOf.get(r.date) ?? 'neutral';
    byPhase[ph] = (byPhase[ph] ?? 0) + 1;
    const m = perKind.get(r.kind) ?? new Map<SymptomPhase, number>();
    m.set(ph, (m.get(ph) ?? 0) + 1);
    perKind.set(r.kind, m);
  }
  for (const d of dates) {
    const ph = phaseOf.get(d) ?? 'neutral';
    daysByPhase[ph] = (daysByPhase[ph] ?? 0) + 1;
  }

  const stats: SymptomStat[] = [];
  for (const [kind, m] of perKind) {
    let count = 0;
    for (const n of m.values()) count += n;
    // Highest count wins. A tie yields null rather than an arbitrary pick: with
    // an even split the data does not support naming a phase.
    let top: SymptomPhase | null = null;
    let topN = 0;
    let tied = false;
    for (const ph of SYMPTOM_PHASES) {
      const n = m.get(ph) ?? 0;
      if (n > topN) { top = ph; topN = n; tied = false; }
      else if (n === topN && n > 0) { tied = true; }
    }
    if (tied || topN < 2) top = null;
    stats.push({ kind, count, topPhase: top, topPhaseCount: topN });
  }
  // Most logged first; kind as the tiebreak so the order is stable.
  stats.sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));

  return {
    total: rows.length,
    days: dates.length,
    first: dates[0] ?? null,
    last: dates[dates.length - 1] ?? null,
    stats,
    byPhase,
    daysByPhase,
  };
}

// ponytail: assert self-check. `node --experimental-strip-types lib/symptom-history.ts`
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('symptom-history.ts')) {
  const periods = [{ start_date: '2026-09-06', end_date: '2026-09-10', type: 'menstruation' }];
  // Cramps on period days, headache spread thin.
  const rows = [
    { date: '2026-09-06', kind: 'cramps' },
    { date: '2026-09-07', kind: 'cramps' },
    { date: '2026-09-08', kind: 'cramps' },
    { date: '2026-09-20', kind: 'headache' },
  ];
  const h = symptomHistory(rows, periods, null);
  console.assert(h.total === 4, 'total ' + h.total);
  console.assert(h.days === 4, 'days ' + h.days);
  console.assert(h.first === '2026-09-06' && h.last === '2026-09-20', 'range');
  const cramps = h.stats.find((s) => s.kind === 'cramps')!;
  console.assert(cramps.count === 3, 'cramps count ' + cramps.count);
  console.assert(cramps.topPhase === 'period', 'cramps phase ' + cramps.topPhase);
  // Headache appears once, below the two-observation floor for naming a phase.
  const headache = h.stats.find((s) => s.kind === 'headache')!;
  console.assert(headache.topPhase === null, 'headache should not name a phase');
  console.assert(h.stats[0].kind === 'cramps', 'sorted by count');
  console.assert(symptomHistory([], periods, null).total === 0, 'empty');
  console.log('symptom-history.ts self-check passed');
}
