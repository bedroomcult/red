import { describe, it, expect } from 'vitest';
import { pregnancyChance, chancePercent } from '../lib/chance';

const pred = (ov: string | null, confidence = 'high') => ({ ov, confidence });
const OV = '2026-09-15';
const at = (d: number) => new Date(Date.parse(OV + 'T00:00:00Z') + d * 864e5).toISOString().slice(0, 10);

describe('pregnancyChance', () => {
  it('peaks on the ovulation day', () => {
    expect(pregnancyChance(OV, pred(OV), false).risk).toBe('high');
  });

  it('rises over the days before ovulation', () => {
    expect(pregnancyChance(at(-3), pred(OV), false).risk).toBe('medium');
    expect(pregnancyChance(at(-2), pred(OV), false).risk).toBe('high');
    expect(pregnancyChance(at(-1), pred(OV), false).risk).toBe('high');
  });

  it('drops sharply after ovulation', () => {
    expect(pregnancyChance(at(1), pred(OV), false).risk).toBe('medium');
    expect(pregnancyChance(at(2), pred(OV), false).risk).toBe('low');
  });

  it('is low outside the fertile window', () => {
    expect(pregnancyChance(at(-10), pred(OV), false).risk).toBe('low');
    expect(pregnancyChance(at(20), pred(OV), false).risk).toBe('low');
  });

  it('returns unknown with no ovulation prediction', () => {
    expect(pregnancyChance(OV, pred(null), false).risk).toBe('unknown');
    expect(pregnancyChance(OV, null, false).risk).toBe('unknown');
  });

  it('returns unknown while birth control suppresses the model', () => {
    // There is no predicted ovulation to compare against, so no estimate is
    // honest. Claiming "low" here would be actively dangerous.
    expect(pregnancyChance(OV, pred(OV), true).risk).toBe('unknown');
  });

  it('returns unknown for an unparseable date', () => {
    expect(pregnancyChance('nonsense', pred(OV), false).risk).toBe('unknown');
  });

  it('reports the day offset from the peak', () => {
    expect(pregnancyChance(OV, pred(OV), false).offset).toBe(0);
    expect(pregnancyChance(at(-2), pred(OV), false).offset).toBe(-2);
    expect(pregnancyChance(at(3), pred(OV), false).offset).toBe(3);
  });
});

describe('chancePercent', () => {
  it('maps the peak to the top of the curve', () => {
    expect(chancePercent(pregnancyChance(OV, pred(OV), false))).toBe(40);
  });

  it('is zero when the estimate is unknown', () => {
    expect(chancePercent({ risk: 'unknown', offset: null })).toBe(0);
  });

  it('never exceeds the peak value', () => {
    for (let d = -10; d <= 10; d++) {
      expect(chancePercent(pregnancyChance(at(d), pred(OV), false))).toBeLessThanOrEqual(40);
    }
  });
});
