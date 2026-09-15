import { describe, it, expect } from 'vitest';
import { predict as clientPredict } from './predict';
import { predict as serverPredict } from '../functions/_predict';
import { insights as clientInsights } from './insights';
import { insights as serverInsights } from '../functions/_insights';

// functions/ must be self-contained for the Pages bundler, so predict.ts and
// insights.ts each exist twice. The prediction is computed on both client and
// server; if the copies diverge the app shows one answer and stores another.
// These tests are the mechanism that keeps them identical.
const PREDICT_CASES: { name: string; starts: string[]; opts: any }[] = [
  { name: 'empty history', starts: [], opts: {} },
  { name: 'single period uses fallback', starts: ['2026-01-01'], opts: {} },
  { name: 'single period with configured cycle_len', starts: ['2026-01-01'], opts: { fallbackCycle: 30 } },
  { name: 'regular 28-day cycles', starts: ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-29'], opts: {} },
  { name: 'implausible 8-day cycle is dropped', starts: ['2026-01-01', '2026-01-09'], opts: {} },
  { name: 'irregular spread sets the flag', starts: ['2026-01-01', '2026-01-20', '2026-02-20'], opts: {} },
  { name: 'short cycle clamps ovulation to day 8', starts: ['2026-01-01', '2026-01-19'], opts: {} },
  { name: 'outlier beyond 2 SD is dropped', starts: ['2026-01-01', '2026-01-29', '2026-02-26', '2026-04-09', '2026-05-07'], opts: {} },
  { name: 'fallbackCycle is clamped to 15..60', starts: ['2026-01-01'], opts: { fallbackCycle: 5 } },
  { name: 'EC LNG widens the window', starts: ['2026-01-01', '2026-01-29', '2026-02-26'], opts: { ecType: 'LNG' } },
  { name: 'EC UPA widens further', starts: ['2026-01-01', '2026-01-29', '2026-02-26'], opts: { ecType: 'UPA' } },
  { name: 'EC copper still suppresses ovulation', starts: ['2026-01-01', '2026-01-29', '2026-02-26'], opts: { ecType: 'copper' } },
  { name: 'BC suppresses all prediction', starts: ['2026-01-01', '2026-01-29'], opts: { bcMode: true } },
];

describe('lib/predict.ts and functions/_predict.ts stay in sync', () => {
  for (const c of PREDICT_CASES) {
    it(c.name, () => {
      expect(serverPredict(c.starts, c.opts)).toEqual(clientPredict(c.starts, c.opts));
    });
  }
});

const PERIOD_SETS: { name: string; periods: any[] }[] = [
  { name: 'no periods', periods: [] },
  {
    name: 'three regular periods',
    periods: [
      { start_date: '2026-01-01', end_date: '2026-01-05', type: 'menstruation' },
      { start_date: '2026-01-29', end_date: '2026-02-02', type: 'menstruation' },
      { start_date: '2026-02-26', end_date: '2026-03-02', type: 'menstruation' },
    ],
  },
  {
    name: 'spotting is excluded from the cycle average',
    periods: [
      { start_date: '2026-01-01', end_date: '2026-01-05', type: 'menstruation' },
      { start_date: '2026-01-15', end_date: null, type: 'spotting' },
      { start_date: '2026-01-29', end_date: '2026-02-02', type: 'menstruation' },
    ],
  },
];

describe('lib/insights.ts and functions/_insights.ts stay in sync', () => {
  for (const c of PERIOD_SETS) {
    it(c.name, () => {
      expect(serverInsights(c.periods)).toEqual(clientInsights(c.periods));
    });
  }
});
