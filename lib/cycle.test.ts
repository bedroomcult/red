import { describe, it, expect } from 'vitest';
import { cycleStatus, predictionStale, dateStale, periodDays, periodForDate } from './cycle';
import { insights } from './insights';

const P = [{ start_date: '2026-01-01', end_date: '2026-01-05' }];
const S = ['2026-01-01'];
const PRED = { next: '2026-01-29', ov: '2026-01-15', confidence: 'high' };

describe('cycleStatus', () => {
  it('period while inside logged range', () => {
    expect(cycleStatus('2026-01-03', S, P, PRED, false).phase).toBe('period');
  });
  it('ovulation on ov day', () => {
    expect(cycleStatus('2026-01-15', S, P, PRED, false).phase).toBe('ovulation');
  });
  it('fertile in ov-5..ov+1', () => {
    expect(cycleStatus('2026-01-12', S, P, PRED, false).phase).toBe('fertile');
  });
  it('pms within 4d of next', () => {
    expect(cycleStatus('2026-01-27', S, P, PRED, false).phase).toBe('pms');
  });
  it('neutral otherwise', () => {
    expect(cycleStatus('2026-01-20', S, P, PRED, false).phase).toBe('neutral');
  });
  it('bc suppresses', () => {
    expect(cycleStatus('2026-01-20', S, P, PRED, true).phase).toBe('bc');
  });
  it('cycleDay counts from last start', () => {
    expect(cycleStatus('2026-01-03', S, P, PRED, false).cycleDay).toBe(3);
  });
});

describe('predictionStale', () => {  const logged = [{ start_date: '2026-01-01', end_date: '2026-01-07', type: 'menstruation' }];
  it('overlapping window is stale (predicted 3-10, logged 1-7)', () => {
    expect(predictionStale(logged, '2026-01-03', '2026-01-10')).toBe(true);
  });
  it('future window is not stale', () => {
    expect(predictionStale(logged, '2026-01-20', '2026-01-27')).toBe(false);
  });
  it('window entirely before last period is stale', () => {
    expect(predictionStale(logged, '2025-12-20', '2025-12-27')).toBe(true);
  });
  it('no logs -> not stale', () => {
    expect(predictionStale([], '2026-01-03', '2026-01-10')).toBe(false);
  });
  it('periodDays honours end_date', () => {
    expect(periodDays({ start_date: '2026-01-01', end_date: '2026-01-03' })).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
  });
});

describe('insights', () => {
  const p = [
    { start_date: '2026-01-01', end_date: '2026-01-05', type: 'menstruation' },
    { start_date: '2026-01-29', end_date: '2026-02-02', type: 'menstruation' },
    { start_date: '2026-02-26', end_date: '2026-03-02', type: 'menstruation' },
  ];
  it('avg cycle + period', () => {
    const r = insights(p);
    expect(r.avgCycle).toBe(28);
    expect(r.avgPeriod).toBe(5);
    expect(r.count).toBe(2);
  });
  it('projects next 3', () => {
    const r = insights(p);
    expect(r.next3).toHaveLength(3);
    expect(r.next3[0]).toBe('2026-03-26');
  });
  it('empty -> nulls', () => {
    expect(insights([]).avgCycle).toBeNull();
  });
});

describe('dateStale (single predicted date, e.g. ovulation)', () => {
  const logged = [{ start_date: '2026-01-01', type: 'menstruation' }];
  it('not stale when after latest logged period start', () => {
    expect(dateStale(logged, '2026-01-23')).toBe(false);
  });
  it('stale when before latest logged period start', () => {
    expect(dateStale(logged, '2025-12-20')).toBe(true);
  });
  it('overlapping a logged period is NOT stale (short-cycle ovulation)', () => {
    const two = [{ start_date: '2026-01-01', type: 'menstruation' }, { start_date: '2026-01-19', type: 'menstruation' }];
    expect(dateStale(two, '2026-01-19')).toBe(false);
  });
  it('no logs / null date -> not stale', () => {
    expect(dateStale([], '2026-01-01')).toBe(false);
    expect(dateStale(logged, null)).toBe(false);
  });
});

describe('periodForDate', () => {
  const P = (start: string, end: string | null, type = 'menstruation') => ({ start_date: start, end_date: end, type });

  it('matches the start day', () => {
    expect(periodForDate([P('2026-01-01', '2026-01-05')], '2026-01-01')?.start_date).toBe('2026-01-01');
  });

  it('matches an interior day', () => {
    expect(periodForDate([P('2026-01-01', '2026-01-05')], '2026-01-03')?.start_date).toBe('2026-01-01');
  });

  it('matches the end day', () => {
    expect(periodForDate([P('2026-01-01', '2026-01-05')], '2026-01-05')?.start_date).toBe('2026-01-01');
  });

  it('does not match the day after the end', () => {
    expect(periodForDate([P('2026-01-01', '2026-01-05')], '2026-01-06')).toBeUndefined();
  });

  it('assumes 5 days when end_date is null', () => {
    expect(periodForDate([P('2026-01-01', null)], '2026-01-05')?.start_date).toBe('2026-01-01');
    expect(periodForDate([P('2026-01-01', null)], '2026-01-06')).toBeUndefined();
  });

  it('ignores spotting', () => {
    expect(periodForDate([P('2026-01-01', '2026-01-05', 'spotting')], '2026-01-03')).toBeUndefined();
  });

  it('returns the containing period when several overlap', () => {
    const ps = [P('2026-01-01', '2026-01-05'), P('2026-01-04', '2026-01-08')];
    expect(periodForDate(ps, '2026-01-06')?.start_date).toBe('2026-01-04');
  });
});
