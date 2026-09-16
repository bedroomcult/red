import { describe, it, expect } from 'vitest';
import { isIsoDate } from './_dates';

// Date.parse rolls impossible dates over instead of rejecting them, so a naive
// shape + parse check accepts "2026-02-31" as March 3. Every date-accepting
// endpoint used that check, so this is the shared guard.
describe('isIsoDate', () => {
  it('accepts real dates', () => {
    expect(isIsoDate('2026-03-05')).toBe(true);
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2024-02-29')).toBe(true); // leap year
  });

  it('rejects dates that Date.parse would roll over', () => {
    expect(isIsoDate('2026-02-31')).toBe(false); // -> 2026-03-03
    expect(isIsoDate('2026-04-31')).toBe(false); // -> 2026-05-01
    expect(isIsoDate('2026-02-29')).toBe(false); // 2026 is not a leap year
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-00-10')).toBe(false);
    expect(isIsoDate('2026-01-00')).toBe(false);
  });

  it('rejects the wrong shape', () => {
    expect(isIsoDate('2026-3-5')).toBe(false);
    expect(isIsoDate('2026-03-05T00:00:00Z')).toBe(false);
    expect(isIsoDate('05-03-2026')).toBe(false);
    expect(isIsoDate('')).toBe(false);
    expect(isIsoDate(null)).toBe(false);
    expect(isIsoDate(20260305)).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
  });
});
