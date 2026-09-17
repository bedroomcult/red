import { describe, it, expect } from 'vitest';
import { pregnancyChance, barWidth } from '../lib/chance';

const pred = (ov: string | null, confidence = 'high') => ({ ov, confidence });
const OV = '2026-09-15';
const at = (d: number) => new Date(Date.parse(OV + 'T00:00:00Z') + d * 864e5).toISOString().slice(0, 10);

// Values are the day-specific conception probabilities from Wilcox 1995 /
// Dunson 1999. They are pinned so a "tweak the numbers" edit has to be deliberate.
describe('pregnancyChance percentages', () => {
  it('peaks at 33% on the ovulation day', () => {
    const c = pregnancyChance(OV, pred(OV), false);
    expect(c.percent).toBe(33);
    expect(c.risk).toBe('high');
    expect(c.offset).toBe(0);
  });

  it('matches the published curve for each offset', () => {
    const expected: Record<number, number> = { '-5': 4, '-4': 8, '-3': 17, '-2': 27, '-1': 31, 0: 33, 1: 5 };
    for (const [off, pct] of Object.entries(expected)) {
      expect(pregnancyChance(at(Number(off)), pred(OV), false).percent).toBe(pct);
    }
  });

  it('drops sharply the day after ovulation', () => {
    expect(pregnancyChance(at(1), pred(OV), false).percent).toBe(5);
    expect(pregnancyChance(at(2), pred(OV), false).percent).toBe(1);
  });

  it('reports outside-window days as below one percent, not zero', () => {
    // Claiming 0% would overstate the model; there is a small residual chance.
    const c = pregnancyChance(at(10), pred(OV), false);
    expect(c.percent).toBe(1);
    expect(c.belowOne).toBe(true);
    expect(c.risk).toBe('low');
  });

  it('bands the risk levels', () => {
    expect(pregnancyChance(at(-2), pred(OV), false).risk).toBe('high');   // 27%
    expect(pregnancyChance(at(-1), pred(OV), false).risk).toBe('high');   // 31%
    expect(pregnancyChance(at(-3), pred(OV), false).risk).toBe('medium'); // 17%
    expect(pregnancyChance(at(-4), pred(OV), false).risk).toBe('medium'); // 8%
    expect(pregnancyChance(at(-5), pred(OV), false).risk).toBe('low');    // 4%
    expect(pregnancyChance(at(1), pred(OV), false).risk).toBe('low');     // 5%
  });

  it('never exceeds the peak', () => {
    for (let d = -15; d <= 15; d++) {
      expect(pregnancyChance(at(d), pred(OV), false).percent!).toBeLessThanOrEqual(33);
    }
  });

  it('returns no number with no ovulation prediction', () => {
    const c = pregnancyChance(OV, pred(null), false);
    expect(c.percent).toBeNull();
    expect(c.risk).toBe('unknown');
  });

  it('returns no number while birth control suppresses the model', () => {
    // Inventing a number here would be worse than showing none.
    const c = pregnancyChance(OV, pred(OV), true);
    expect(c.percent).toBeNull();
    expect(c.risk).toBe('unknown');
  });

  it('returns no number for an unparseable date', () => {
    expect(pregnancyChance('nonsense', pred(OV), false).percent).toBeNull();
  });

  it('reports the day offset from the peak', () => {
    expect(pregnancyChance(at(-2), pred(OV), false).offset).toBe(-2);
    expect(pregnancyChance(at(3), pred(OV), false).offset).toBe(3);
  });
});

describe('barWidth', () => {
  it('scales the peak to full width', () => {
    expect(barWidth(pregnancyChance(OV, pred(OV), false))).toBe(100);
  });

  it('is zero when there is no estimate', () => {
    expect(barWidth({ risk: 'unknown', percent: null, offset: null, belowOne: false })).toBe(0);
  });

  it('never exceeds full width', () => {
    for (let d = -15; d <= 15; d++) {
      expect(barWidth(pregnancyChance(at(d), pred(OV), false))).toBeLessThanOrEqual(100);
    }
  });
});
