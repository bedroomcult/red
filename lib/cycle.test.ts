import { describe, it, expect } from 'vitest';
import { cycleStatus } from './cycle';
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
