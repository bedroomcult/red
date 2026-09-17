import { describe, it, expect } from 'vitest';
import { predict, explainPrediction } from '../lib/predict';

// The day sheet used to state the conclusion ("this day falls in the predicted
// window") without the reasoning, so a user could not tell a 2-day window built
// from six logged cycles apart from a 10-day window built from two. These pin
// the facts the sheet now shows.

const starts = ['2026-07-12', '2026-08-09', '2026-09-06'];
const pred = predict(starts, { fallbackCycle: 28 });

describe('explainPrediction', () => {
  it('reports the window bounds and width', () => {
    const r = explainPrediction(pred.lo!, starts, pred);
    expect(r.windowLo).toBe(pred.lo);
    expect(r.windowHi).toBe(pred.hi);
    expect(r.windowDays).toBeGreaterThan(0);
  });

  it('reports observed cycles and the average behind them', () => {
    const r = explainPrediction(pred.lo!, starts, pred);
    expect(r.observedCycles).toBe(2);
    expect(r.avgCycle).toBe(28);
    expect(r.estimated).toBe(false);
  });

  it('names a date inside the window, with its offset from the peak', () => {
    const r = explainPrediction(pred.next!, starts, pred);
    expect(r.kind).toBe('in-window');
    expect(r.daysFromNext).toBe(0);
  });

  it('distinguishes the ovulation peak from the fertile window', () => {
    const peak = explainPrediction(pred.ov!, starts, pred);
    expect(peak.kind).toBe('ovulation');
    expect(peak.inFertile).toBe(true);
    // One day before the peak is fertile but not the peak.
    const before = new Date(Date.parse(pred.ov! + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10);
    expect(explainPrediction(before, starts, pred).kind).toBe('fertile');
  });

  it('marks a date outside every window', () => {
    // 2026-09-20 happens to be the ovulation day for this history, so pick a
    // date well clear of the window and the fertile range.
    const r = explainPrediction('2026-09-28', starts, pred);
    expect(r.kind).toBe('outside');
    expect(r.inFertile).toBe(false);
  });

  it('reports bc when predictions are suppressed', () => {
    const r = explainPrediction(
      '2026-09-20', starts,
      { next: null, lo: null, hi: null, ov: null, confidence: 'suppressed', flags: ['bc-suppressed'] },
      { bcMode: true }
    );
    expect(r.kind).toBe('bc');
    expect(r.avgCycle).toBeNull();
  });

  it('reports no-data when nothing is logged', () => {
    const r = explainPrediction('2026-09-20', [], { next: null, lo: null, hi: null, ov: null, confidence: 'low', flags: ['need-more-data'] });
    expect(r.kind).toBe('no-data');
    expect(r.observedCycles).toBe(0);
  });

  it('flags an estimated average rather than reporting it as measured', () => {
    const one = predict(['2026-09-06'], { fallbackCycle: 28 });
    const r = explainPrediction(one.lo!, ['2026-09-06'], one);
    expect(r.estimated).toBe(true);
    expect(r.avgCycle).toBeNull();
    expect(r.observedCycles).toBe(0);
  });

  it('surfaces an irregular spread', () => {
    // Cycles of 20 and 40 days. The flag fires on the observed range, which here
    // is 20, well past the >9 threshold.
    const erratic = predict(['2026-05-01', '2026-05-21', '2026-06-30'], { fallbackCycle: 28 });
    const r = explainPrediction(erratic.lo!, ['2026-05-01', '2026-05-21', '2026-06-30'], erratic);
    expect(r.irregular).toBe(true);
    expect(r.spread).toBeGreaterThan(9);
  });

  it('passes the EC type through', () => {
    const ec = predict(['2026-09-06'], { ecType: 'UPA', fallbackCycle: 28 });
    const r = explainPrediction(ec.lo!, ['2026-09-06'], ec, { ecType: 'UPA' });
    expect(r.ecType).toBe('UPA');
    expect(r.kind).toBe('in-window');
  });

  it('agrees with the calendar on which window wins', () => {
    // The calendar checks pred-period before fertile. A date inside both must
    // read as the predicted period here too, or the two surfaces disagree.
    const overlapping = {
      next: '2026-09-10', lo: '2026-09-08', hi: '2026-09-12',
      ov: '2026-09-09', confidence: 'med', flags: [],
    };
    expect(explainPrediction('2026-09-09', starts, overlapping).kind).toBe('in-window');
  });
});
