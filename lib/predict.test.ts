import { describe, it, expect } from 'vitest';
import { predict, cycleStats, ecDisrupts } from './predict';

describe('predict', () => {
  it('avgs 28,28,31 -> next Apr27, window from the observed range', () => {
    const r = predict(['2026-01-01','2026-01-29','2026-02-26','2026-03-29'], {});
    expect(r.next).toBe('2026-04-27');
    // Cycles 28,28,31: observed range 3d, so "high" even though the padded
    // window is 9 days wide.
    expect(r.confidence).toBe('high');
    expect(r.lo).toBe('2026-04-23');
    expect(r.hi).toBe('2026-05-02');
  });
  it('regular cycles still get a narrow window and high confidence', () => {
    const r = predict(['2026-01-01','2026-01-29','2026-02-26','2026-03-26','2026-04-23','2026-05-21'], {});
    // 5 cycles of 28 -> pad 2 -> 26..30, 5d wide.
    expect(r.confidence).toBe('high');
    expect(r.flags).not.toContain('irregular');
    expect(r.lo).toBe('2026-06-16');
    expect(r.hi).toBe('2026-06-20');
  });
  it('covers a mildly irregular cycle that the old SD rule missed', () => {
    // 26,31,28,27,32,29 has an SD of ~1.7. The previous rule used
    // max(round(sd), 2) = +/-2d, which missed most of these cycles.
    const r = predict(['2026-01-01','2026-01-27','2026-02-27','2026-03-27','2026-04-23','2026-05-25','2026-06-23'], {});
    expect(r.lo).toBe('2026-07-17');
    expect(r.hi).toBe('2026-07-27');
    // Observed range 6d -> "med". The old SD rule gave +/-2d here and missed 42%.
    expect(r.confidence).toBe('med');
  });
  it('widens and flags a genuinely irregular cycle', () => {
    const r = predict(['2026-01-01','2026-01-22','2026-03-01','2026-03-26','2026-05-05','2026-05-28'], {});
    expect(r.flags).toContain('irregular');
    expect(r.confidence).toBe('low');
    expect(r.lo).toBe('2026-06-15');
    expect(r.hi).toBe('2026-07-08');
  });
  it('never narrows the window below 15..60 days of cycle length', () => {
    const r = predict(['2026-01-01','2026-01-16','2026-02-01'], {});
    // 15d cycles: cycleLo is clamped at 15, so the low edge cannot go below it.
    expect(r.lo! >= '2026-02-02').toBe(true);
  });
  it('single period -> 28d fallback, low, estimated flag', () => {
    const r = predict(['2026-01-01'], {});
    expect(r.next).toBe('2026-01-29');
    expect(r.confidence).toBe('low');
    expect(r.flags).toContain('estimated');
  });
  it('single period uses configured fallbackCycle', () => {
    const r = predict(['2026-01-01'], { fallbackCycle: 30 });
    expect(r.next).toBe('2026-01-31');
  });
  it('implausible 2d cycle is dropped, falls back to configured length', () => {
    const r = predict(['2026-01-01', '2026-01-03'], { fallbackCycle: 28 });
    expect(r.flags).toContain('estimated');
    expect(r.next).toBe('2026-01-31');
  });
  it('fertile ov = next - 14d', () => {
    const r = predict(['2026-01-01','2026-01-29'], {});
    expect(r.ov).toBe('2026-02-12');
  });
  it('short cycle clamps ov out of the logged period (day 8 floor)', () => {
    // 18d cycle: unclamped ov 2026-01-23 falls inside the 01-19..01-23 period.
    const r = predict(['2026-01-01','2026-01-19'], {});
    expect(r.next).toBe('2026-02-06');
    expect(r.ov).toBe('2026-01-26');
    expect(r.ov! > '2026-01-23').toBe(true);
  });
  it('very short cycle still yields an ov after the period', () => {
    const r = predict(['2026-01-01','2026-01-16'], {});
    expect(r.ov).toBe('2026-01-23');
  });
  it('bc suppresses everything', () => {
    const r = predict(['2026-01-01','2026-01-29'], { bcMode: true });
    expect(r.next).toBeNull();
    expect(r.confidence).toBe('suppressed');
  });
});

// cycleStats is the single definition of the user's cycle statistics; insights
// imports it so the Wawasan screen and the prediction cannot disagree.
describe('cycleStats', () => {
  it('returns the fallback cycle and estimated flag for 0-1 periods', () => {
    const none = cycleStats([]);
    expect(none.ds.length).toBe(0);
    expect(none.last).toBeNull();
    expect(none.estimated).toBe(true);
    expect(none.cycles).toEqual([28]);

    const one = cycleStats(['2026-01-01'], 30);
    expect(one.estimated).toBe(true);
    expect(one.cycles).toEqual([30]);
  });

  it('computes avg and sd over real cycles', () => {
    const s = cycleStats(['2026-01-01', '2026-01-29', '2026-02-26']);
    expect(s.estimated).toBe(false);
    expect(s.cycles).toEqual([28, 28]);
    expect(s.avg).toBe(28);
    expect(s.sd).toBe(0);
    expect(s.range).toBe(0);
  });

  it('drops implausible cycles outside the 15..60d band', () => {
    const s = cycleStats(['2026-01-01', '2026-01-09', '2026-02-06']);
    expect(s.cycles).toEqual([28]);
  });

  it('flags estimated when every cycle is implausible', () => {
    const s = cycleStats(['2026-01-01', '2026-01-05']);
    expect(s.estimated).toBe(true);
    expect(s.cycles).toEqual([28]);
  });

  it('drops a single outlier beyond 2 SD', () => {
    // 6 cycles (the slice(-6) cap), last one 60d. With n=6 a lone outlier sits at
    // |z| = sqrt(5) ~ 2.24, just past the 2 SD threshold, so it is dropped.
    const s = cycleStats([
      '2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26', '2026-04-23', '2026-05-21', '2026-07-20',
    ]);
    expect(s.cycles).toEqual([28, 28, 28, 28, 28]);
    expect(s.avg).toBe(28);
  });
});

describe('ecDisrupts', () => {
  const ago = (d: number) => new Date(Date.now() - d * 864e5).toISOString();
  const agoDate = (d: number) => ago(d).slice(0, 10);

  it('does not disrupt when there is no EC event', () => {
    expect(ecDisrupts(null, '2026-01-01')).toBe(false);
  });

  it('does not disrupt on an unparseable intake date', () => {
    expect(ecDisrupts('not-a-date', '2026-01-01')).toBe(false);
  });

  it('disrupts a recent dose with no period logged since', () => {
    expect(ecDisrupts(ago(3), null)).toBe(true);
  });

  it('stops disrupting once a period is logged after the dose', () => {
    expect(ecDisrupts(ago(3), agoDate(1))).toBe(false);
  });

  it('still disrupts when the last period predates the dose', () => {
    expect(ecDisrupts(ago(3), agoDate(10))).toBe(true);
  });

  it('expires after two cycles at the given cycle length', () => {
    expect(ecDisrupts(ago(60), null, 28)).toBe(false); // 56d window
    expect(ecDisrupts(ago(40), null, 28)).toBe(true);
    expect(ecDisrupts(ago(40), null, 15)).toBe(false); // 30d window
  });

  it('clamps the cycle length to the 15..60 range', () => {
    expect(ecDisrupts(ago(40), null, 5)).toBe(false); // clamped to 15 -> 30d window
    expect(ecDisrupts(ago(40), null, 999)).toBe(true); // clamped to 60 -> 120d window
  });
});
