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
    const ins = insights(periods, 28, 5, undefined, '2026-03-05');
    const stats = cycleStats(['2026-01-01', '2026-01-29', '2026-02-26']);
    expect(ins.avgCycle).toBe(Math.round(stats.avg));
    expect(ins.avgPeriod).toBe(5);
    expect(ins.count).toBe(2);
    expect(ins.estimated).toBe(false);
  });

  it('next6[0] equals the prediction date when stats are shared', () => {
    const stats = cycleStats(['2026-01-01', '2026-01-29', '2026-02-26']);
    // todayIn/`today` pin the roll-forward so the two stay comparable without
    // depending on the machine clock.
    const TODAY = '2026-03-05';
    const ins = insights(periods, 28, 5, stats, TODAY);
    const pred = predict(['2026-01-01', '2026-01-29', '2026-02-26'], { today: TODAY }, stats);
    expect(ins.next6[0]).toBe(pred.next);
    expect(ins.next6).toEqual(['2026-03-26', '2026-04-23', '2026-05-21', '2026-06-18', '2026-07-16', '2026-08-13']);
  });

  it('ignores an implausible cycle the prediction also drops', () => {
    // A 4-day gap is a mis-tap; both sides must ignore it rather than report avg 4.
    const withMistap = [P('2026-01-01'), P('2026-01-05'), P('2026-02-02')];
    const ins = insights(withMistap, 28, 5, undefined, '2026-02-10');
    expect(ins.count).toBe(1);
    expect(ins.avgCycle).toBe(28);
    expect(ins.shortest).toBe(28);
  });

  it('marks single-period data as estimated and falls back to the configured length', () => {
    const ins = insights([P('2026-01-01', '2026-01-05')], 30, 5, undefined, '2026-01-10');
    expect(ins.estimated).toBe(true);
    expect(ins.avgCycle).toBeNull();
    expect(ins.next6).toEqual(['2026-01-31', '2026-03-02', '2026-04-01', '2026-05-01', '2026-05-31', '2026-06-30']);
  });

  it('handles no data without throwing', () => {
    const ins = insights([], 28, 5, undefined, '2026-03-05');
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
    expect(insights(periods, 28, 5, undefined, '2026-03-05').next6).toHaveLength(6);
  });

  it('spaces them by the average cycle length', () => {
    const got = insights(periods, 28, 5, undefined, '2026-03-05').next6;
    for (let i = 1; i < got.length; i++) {
      const gap = Math.round((Date.parse(got[i] + 'T00:00:00Z') - Date.parse(got[i - 1] + 'T00:00:00Z')) / 864e5);
      expect(gap).toBe(28);
    }
  });

  it('starts from the last observed period, not today', () => {
    expect(insights(periods, 28, 5, undefined, '2026-03-05').next6[0]).toBe('2026-03-26');
  });

  it('still returns six when the average is a fallback', () => {
    // One period is not enough for an average, so cycle_len is used; the list
    // must not silently shorten.
    const ins = insights([periods[0]], 30, 5, undefined, '2026-01-10');
    expect(ins.next6).toHaveLength(6);
    expect(ins.estimated).toBe(true);
  });

  it('returns nothing with no logged periods', () => {
    expect(insights([], 28, 5, undefined, '2026-03-05').next6).toEqual([]);
  });

  it('never reaches cycle 7 or beyond', () => {
    // Guards the cut-off itself: a later "just add more" edit fails here.
    expect(insights(periods, 28, 5, undefined, '2026-03-05').next6).toHaveLength(6);
    expect(insights(periods, 28, 5, undefined, '2026-03-05').next6.at(-1)).toBe('2026-08-13');
  });
});

// A user who has not logged for months must still see the next six periods, not
// a list of dates that have already passed.
describe('next6 skips elapsed cycles', () => {
  const stale = [
    { start_date: '2026-06-01', end_date: '2026-06-05', type: 'menstruation' },
    { start_date: '2026-06-29', end_date: '2026-07-03', type: 'menstruation' },
    { start_date: '2026-07-27', end_date: '2026-07-31', type: 'menstruation' },
  ];

  it('starts at the first cycle still in the future', () => {
    const ins = insights(stale, 28, 5, undefined, '2026-09-17');
    expect(ins.next6[0]! >= '2026-09-17').toBe(true);
    expect(ins.next6[0]).toBe('2026-09-21');
  });

  it('still returns six entries', () => {
    expect(insights(stale, 28, 5, undefined, '2026-09-17').next6).toHaveLength(6);
  });

  it('keeps every entry in the future', () => {
    const ins = insights(stale, 28, 5, undefined, '2026-09-17');
    for (const d of ins.next6) expect(d >= '2026-09-17').toBe(true);
  });

  it('does not shift a list that is already current', () => {
    const fresh = [{ start_date: '2026-09-01', end_date: '2026-09-05', type: 'menstruation' }];
    const ins = insights(fresh, 28, 5, undefined, '2026-09-17');
    expect(ins.next6[0]).toBe('2026-09-29');
  });
});
