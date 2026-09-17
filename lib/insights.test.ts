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

  it('next6[0] equals the prediction date when stats are shared', () => {
    const stats = cycleStats(['2026-01-01', '2026-01-29', '2026-02-26']);
    const ins = insights(periods, 28, 5, stats);
    const pred = predict(['2026-01-01', '2026-01-29', '2026-02-26'], {}, stats);
    expect(ins.next6[0]).toBe(pred.next);
    expect(ins.next6).toEqual(['2026-03-26', '2026-04-23', '2026-05-21', '2026-06-18', '2026-07-16', '2026-08-13']);
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
    expect(ins.next6).toEqual(['2026-01-31', '2026-03-02', '2026-04-01', '2026-05-01', '2026-05-31', '2026-06-30']);
  });

  it('handles no data without throwing', () => {
    const ins = insights([]);
    expect(ins.avgCycle).toBeNull();
    expect(ins.avgPeriod).toBeNull();
    expect(ins.next6).toEqual([]);
    expect(ins.estimated).toBe(true);
  });

  it('ignores spotting when computing cycle length', () => {
    const ins = insights([P('2026-01-01'), P('2026-01-10', null, 'spotting'), P('2026-01-29')]);
    expect(ins.count).toBe(1);
    expect(ins.avgCycle).toBe(28);
  });
});

// The projection compounds the average cycle length, so the error grows with the
// cycle index. Six is the cut-off: by cycle 7 the window is wider than a whole
// cycle and the date stops carrying information.
describe('next6 projection', () => {
  const periods = [
    { start_date: '2026-01-01', end_date: '2026-01-05', type: 'menstruation' },
    { start_date: '2026-01-29', end_date: '2026-02-02', type: 'menstruation' },
    { start_date: '2026-02-26', end_date: '2026-03-02', type: 'menstruation' },
  ];

  it('returns exactly six entries', () => {
    expect(insights(periods).next6).toHaveLength(6);
  });

  it('spaces them by the average cycle length', () => {
    const got = insights(periods).next6;
    for (let i = 1; i < got.length; i++) {
      const gap = Math.round((Date.parse(got[i] + 'T00:00:00Z') - Date.parse(got[i - 1] + 'T00:00:00Z')) / 864e5);
      expect(gap).toBe(28);
    }
  });

  it('starts from the last observed period, not today', () => {
    expect(insights(periods).next6[0]).toBe('2026-03-26');
  });

  it('still returns six when the average is a fallback', () => {
    // One period is not enough for an average, so cycle_len is used; the list
    // must not silently shorten.
    const ins = insights([periods[0]], 30);
    expect(ins.next6).toHaveLength(6);
    expect(ins.estimated).toBe(true);
  });

  it('returns nothing with no logged periods', () => {
    expect(insights([]).next6).toEqual([]);
  });

  it('never reaches cycle 7 or beyond', () => {
    // Guards the cut-off itself: a later "just add more" edit fails here.
    expect(insights(periods).next6).toHaveLength(6);
    expect(insights(periods, 28, 5).next6.at(-1)).toBe('2026-08-13');
  });
});
