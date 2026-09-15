import { describe, it, expect } from 'vitest';
import { insights } from './insights';
import { predict, cycleStats } from './predict';

const P = (start: string, end: string | null = null, type = 'menstruation') => ({
  start_date: start,
  end_date: end,
  type,
});

// The Wawasan screen and the Home/Calendar prediction read the same user data.
// If they compute cycle length differently the user sees two different answers,
// so these tests pin the shared-stats contract.
describe('insights / predict alignment', () => {
  const periods = [P('2026-01-01', '2026-01-05'), P('2026-01-29', '2026-02-02'), P('2026-02-26', '2026-03-02')];

  it('reports the same average cycle as the prediction uses', () => {
    const ins = insights(periods);
    const stats = cycleStats(['2026-01-01', '2026-01-29', '2026-02-26']);
    expect(ins.avgCycle).toBe(Math.round(stats.avg));
    expect(ins.avgPeriod).toBe(5);
    expect(ins.count).toBe(2);
    expect(ins.estimated).toBe(false);
  });

  it('next3[0] equals the prediction date when stats are shared', () => {
    const stats = cycleStats(['2026-01-01', '2026-01-29', '2026-02-26']);
    const ins = insights(periods, 28, 5, stats);
    const pred = predict(['2026-01-01', '2026-01-29', '2026-02-26'], {}, stats);
    expect(ins.next3[0]).toBe(pred.next);
    expect(ins.next3).toEqual(['2026-03-26', '2026-04-23', '2026-05-21']);
  });

  it('ignores an implausible cycle the prediction also drops', () => {
    // A 4-day gap is a mis-tap; both sides must ignore it rather than report avg 4.
    const withMistap = [P('2026-01-01'), P('2026-01-05'), P('2026-02-02')];
    const ins = insights(withMistap);
    expect(ins.count).toBe(1);
    expect(ins.avgCycle).toBe(28);
    expect(ins.shortest).toBe(28);
  });

  it('marks single-period data as estimated and falls back to the configured length', () => {
    const ins = insights([P('2026-01-01', '2026-01-05')], 30);
    expect(ins.estimated).toBe(true);
    expect(ins.avgCycle).toBeNull();
    expect(ins.next3).toEqual(['2026-01-31', '2026-03-02', '2026-04-01']);
  });

  it('handles no data without throwing', () => {
    const ins = insights([]);
    expect(ins.avgCycle).toBeNull();
    expect(ins.avgPeriod).toBeNull();
    expect(ins.next3).toEqual([]);
    expect(ins.estimated).toBe(true);
  });

  it('ignores spotting when computing cycle length', () => {
    const ins = insights([P('2026-01-01'), P('2026-01-10', null, 'spotting'), P('2026-01-29')]);
    expect(ins.count).toBe(1);
    expect(ins.avgCycle).toBe(28);
  });
});
