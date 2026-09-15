import { describe, it, expect } from 'vitest';
import { localDate, isIsoDate } from './today';

// The app is used in WIB (UTC+7). `new Date().toISOString().slice(0,10)` returns
// yesterday's date until 07:00 local, which put symptom and BC-dose logs on the
// wrong day. These tests pin local calendar rendering, not the host clock, by
// constructing dates with the local-time Date constructor.
describe('localDate', () => {
  it('returns the local date just after local midnight (the UTC bug)', () => {
    expect(localDate(new Date(2026, 0, 15, 0, 30))).toBe('2026-01-15');
  });

  it('returns the local date just before local midnight', () => {
    expect(localDate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });

  it('zero-pads month and day', () => {
    expect(localDate(new Date(2026, 0, 5, 12, 0))).toBe('2026-01-05');
  });
});

describe('isIsoDate', () => {
  it('accepts a valid date', () => {
    expect(isIsoDate('2026-01-15')).toBe(true);
  });

  it('rejects unpadded, impossible, empty and non-string input', () => {
    expect(isIsoDate('2026-2-5')).toBe(false);
    expect(isIsoDate('2026-02-31')).toBe(false);
    expect(isIsoDate('')).toBe(false);
    expect(isIsoDate(null)).toBe(false);
    expect(isIsoDate(20260115)).toBe(false);
  });
});
