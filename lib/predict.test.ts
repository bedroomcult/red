import { describe, it, expect } from 'vitest';
import { predict } from './predict';
describe('predict', () => {
  it('avgs 28,28,31 -> next Apr27 window ±2 high', () => {
    const r = predict(['2026-01-01','2026-01-29','2026-02-26','2026-03-29'], {});
    expect(r.next).toBe('2026-04-27');
    expect(r.confidence).toBe('high');
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
