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
  it('fertile ov = next - 14d', () => {
    const r = predict(['2026-01-01','2026-01-29'], {});
    expect(r.ov).toBe('2026-02-12');
  });
  it('bc suppresses everything', () => {
    const r = predict(['2026-01-01','2026-01-29'], { bcMode: true });
    expect(r.next).toBeNull();
    expect(r.confidence).toBe('suppressed');
  });
});
