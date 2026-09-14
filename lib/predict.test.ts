import { describe, it, expect } from 'vitest';
import { predict } from './predict';
describe('predict', () => {
  it('avgs 28,28,31 -> next Apr27 window ±2 high', () => {
    const r = predict(['2026-01-01','2026-01-29','2026-02-26','2026-03-29'], {});
    expect(r.next).toBe('2026-04-27');
    expect(r.confidence).toBe('high');
  });
});
