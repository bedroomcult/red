import { describe, it, expect } from 'vitest';
import { symptomHistory } from '../lib/symptom-history';

// Symptoms were stored from the start but only ever read back for today, so a
// logged symptom vanished the next morning. These pin the aggregation that makes
// the stored rows readable, and the rule that a phase is never named from too
// little data.

const periods = [{ start_date: '2026-09-06', end_date: '2026-09-10', type: 'menstruation' }];
const pred = { next: '2026-09-30', ov: '2026-09-16', confidence: 'med' };

describe('symptomHistory', () => {
  it('reports nothing for an empty log', () => {
    const h = symptomHistory([], periods, pred);
    expect(h.total).toBe(0);
    expect(h.days).toBe(0);
    expect(h.stats).toEqual([]);
    expect(h.first).toBeNull();
  });

  it('counts occurrences and distinct days', () => {
    const h = symptomHistory(
      [
        { date: '2026-09-06', kind: 'cramps' },
        { date: '2026-09-06', kind: 'tired' },
        { date: '2026-09-08', kind: 'cramps' },
      ],
      periods, pred
    );
    expect(h.total).toBe(3);
    expect(h.days).toBe(2);
    expect(h.first).toBe('2026-09-06');
    expect(h.last).toBe('2026-09-08');
    expect(h.stats.find((s) => s.kind === 'cramps')?.count).toBe(2);
  });

  it('names the phase a symptom clusters in', () => {
    // 06-08 fall inside the logged period; 09-20 is well outside it.
    const h = symptomHistory(
      [
        { date: '2026-09-06', kind: 'cramps' },
        { date: '2026-09-07', kind: 'cramps' },
        { date: '2026-09-20', kind: 'cramps' },
      ],
      periods, pred
    );
    expect(h.stats.find((s) => s.kind === 'cramps')?.topPhase).toBe('period');
  });

  it('does not name a phase from one observation', () => {
    const h = symptomHistory([{ date: '2026-09-06', kind: 'acne' }], periods, pred);
    const acne = h.stats.find((s) => s.kind === 'acne')!;
    expect(acne.count).toBe(1);
    expect(acne.topPhase).toBeNull();
  });

  it('does not name a phase when the counts tie', () => {
    // One period day, one fertile day: no phase wins.
    const h = symptomHistory(
      [
        { date: '2026-09-06', kind: 'headache' },
        { date: '2026-09-16', kind: 'headache' },
      ],
      periods, pred
    );
    expect(h.stats.find((s) => s.kind === 'headache')?.topPhase).toBeNull();
  });

  it('sorts by count, with kind as a stable tiebreak', () => {
    const h = symptomHistory(
      [
        { date: '2026-09-06', kind: 'tired' },
        { date: '2026-09-07', kind: 'tired' },
        { date: '2026-09-08', kind: 'acne' },
        { date: '2026-09-09', kind: 'acne' },
      ],
      periods, pred
    );
    expect(h.stats.map((s) => s.kind)).toEqual(['acne', 'tired']);
  });

  it('buckets counts and days by phase', () => {
    const h = symptomHistory(
      [
        { date: '2026-09-06', kind: 'cramps' },
        { date: '2026-09-06', kind: 'tired' },
        { date: '2026-09-16', kind: 'mood' },
      ],
      periods, pred
    );
    expect(h.byPhase.period).toBe(2);
    expect(h.daysByPhase.period).toBe(1);
    expect(h.byPhase.ovulation).toBe(1);
  });

  it('attributes everything to bc when predictions are suppressed', () => {
    const h = symptomHistory(
      [
        { date: '2026-09-06', kind: 'cramps' },
        { date: '2026-09-20', kind: 'cramps' },
      ],
      periods, pred, true
    );
    expect(h.byPhase.bc).toBe(2);
    expect(h.stats.find((s) => s.kind === 'cramps')?.topPhase).toBe('bc');
  });

  it('works with no prediction at all', () => {
    const h = symptomHistory(
      [
        { date: '2026-09-06', kind: 'cramps' },
        { date: '2026-09-07', kind: 'cramps' },
      ],
      periods, null
    );
    expect(h.total).toBe(2);
    expect(h.stats.find((s) => s.kind === 'cramps')?.topPhase).toBe('period');
  });
});
