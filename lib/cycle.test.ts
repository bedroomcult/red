import { describe, it, expect } from 'vitest';
import {
  cycleStatus, predictionStale, dateStale, periodDays, periodForDate,
  ongoingPeriodDays, needsEndPrompt, periodToExtend,
} from './cycle';
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

describe('ongoingPeriodDays', () => {
  it('paints up to the user period_len, not a hardcoded 5', () => {
    // The old code hardcoded 5 days in two places, ignoring period_len.
    expect(ongoingPeriodDays({ start_date: '2026-09-01', end_date: null }, 7, '2026-09-30')).toHaveLength(7);
    expect(ongoingPeriodDays({ start_date: '2026-09-01', end_date: null }, 7, '2026-09-30').at(-1)).toBe('2026-09-07');
  });

  it('does not paint past today', () => {
    const days = ongoingPeriodDays({ start_date: '2026-09-01', end_date: null }, 7, '2026-09-03');
    expect(days).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
  });

  it('starts on the start date', () => {
    expect(ongoingPeriodDays({ start_date: '2026-09-01', end_date: null }, 5, '2026-09-30')[0]).toBe('2026-09-01');
  });
});

describe('needsEndPrompt', () => {
  it('is false before the expected length', () => {
    expect(needsEndPrompt({ start_date: '2026-09-01', end_date: null }, 5, '2026-09-04')).toBe(false);
  });

  it('fires exactly at the expected length', () => {
    expect(needsEndPrompt({ start_date: '2026-09-01', end_date: null }, 5, '2026-09-05')).toBe(true);
  });

  it('keeps firing while the period stays open', () => {
    expect(needsEndPrompt({ start_date: '2026-09-01', end_date: null }, 5, '2026-09-12')).toBe(true);
  });

  it('is false once an end date exists', () => {
    expect(needsEndPrompt({ start_date: '2026-09-01', end_date: '2026-09-05' }, 5, '2026-09-20')).toBe(false);
  });

  it('respects a longer configured period_len', () => {
    expect(needsEndPrompt({ start_date: '2026-09-01', end_date: null }, 8, '2026-09-07')).toBe(false);
    expect(needsEndPrompt({ start_date: '2026-09-01', end_date: null }, 8, '2026-09-08')).toBe(true);
  });
});

describe('periodToExtend', () => {
  const P = (start: string, end: string | null = null) => ({ start_date: start, end_date: end, type: 'menstruation' });

  it('merges a start inside the ongoing range', () => {
    expect(periodToExtend([P('2026-09-01')], '2026-09-03', 5)?.start_date).toBe('2026-09-01');
  });

  it('merges a start within the gap after the range', () => {
    // Range is 09-01..09-05; 09-07 is 2 days later, inside MERGE_GAP_DAYS.
    expect(periodToExtend([P('2026-09-01')], '2026-09-07', 5)?.start_date).toBe('2026-09-01');
  });

  it('does not merge a start beyond the gap', () => {
    expect(periodToExtend([P('2026-09-01')], '2026-09-08', 5)).toBeUndefined();
  });

  it('does not merge into a finished period', () => {
    // A closed period followed by a new bleed is a new cycle, not an extension.
    expect(periodToExtend([P('2026-09-01', '2026-09-05')], '2026-09-07', 5)).toBeUndefined();
  });

  it('does not merge an earlier start into a later period', () => {
    expect(periodToExtend([P('2026-09-10')], '2026-09-01', 5)).toBeUndefined();
  });

  it('ignores spotting', () => {
    expect(periodToExtend([{ start_date: '2026-09-01', end_date: null, type: 'spotting' }], '2026-09-03', 5)).toBeUndefined();
  });

  it('uses the user period_len when judging the gap', () => {
    // 09-01 + 8 days = 09-08, so 09-10 is within the 2-day gap.
    expect(periodToExtend([P('2026-09-01')], '2026-09-10', 8)?.start_date).toBe('2026-09-01');
    expect(periodToExtend([P('2026-09-01')], '2026-09-10', 5)).toBeUndefined();
  });
});

describe('cycleStatus with an ongoing period', () => {
  const starts = ['2026-09-01'];
  const ranges = [{ start_date: '2026-09-01', end_date: null }];

  it('stays in the period phase through the configured length', () => {
    // Previously the phase silently became neutral after 5 days even though the
    // user was still bleeding.
    expect(cycleStatus('2026-09-05', starts, ranges, null, false, 7).phase).toBe('period');
    expect(cycleStatus('2026-09-07', starts, ranges, null, false, 7).phase).toBe('period');
  });

  it('leaves the period phase after the configured length', () => {
    expect(cycleStatus('2026-09-08', starts, ranges, null, false, 7).phase).toBe('neutral');
  });

  it('honours the old 5-day default when no period_len is passed', () => {
    expect(cycleStatus('2026-09-05', starts, ranges, null, false).phase).toBe('period');
    expect(cycleStatus('2026-09-06', starts, ranges, null, false).phase).toBe('neutral');
  });
});
