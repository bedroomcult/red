// Estimated chance of pregnancy from one act of intercourse on a given day.
//
// Source for the curve: Wilcox AJ, Weinberg CR, Baird DD. "Timing of sexual
// intercourse in relation to ovulation." N Engl J Med 1995;333:1517-21, and the
// pooled re-analysis in Dunson DB et al., Hum Reprod 1999;14:1835-9. These are
// the standard day-specific conception probabilities, measured against a
// confirmed ovulation day.
//
// What this number is and is not:
//   - it is a POPULATION AVERAGE for a single act of intercourse on that day,
//     not a personal probability
//   - it assumes the predicted ovulation day is correct. Real ovulation varies
//     by roughly +/- 2 days even in regular cycles, so the day itself may be off
//   - it is not a fertility test and says nothing about either partner's health
// The UI repeats these limits; see ChanceCard and test/chance-wording.test.ts.
export type Risk = 'high' | 'medium' | 'low' | 'unknown';

export type Chance = {
  risk: Risk;
  // Whole percent, or null when no estimate is possible.
  percent: number | null;
  // Day offset from the predicted ovulation day; 0 is the peak.
  offset: number | null;
  // True when the value is a floor rather than a measurement ("<1%").
  belowOne: boolean;
};

// Day-specific probability, keyed by offset from ovulation. Absent offsets fall
// back to BASELINE.
const BY_OFFSET: Record<number, number> = {
  '-5': 0.04,
  '-4': 0.08,
  '-3': 0.17,
  '-2': 0.27,
  '-1': 0.31,
  '0': 0.33,
  '1': 0.05,
};

// Days well outside the window are not literally zero, so this is reported as
// "<1%" rather than "0%": claiming impossibility would overstate the model.
const BASELINE = 0.005;

export function pregnancyChance(
  date: string,
  prediction: { ov: string | null; confidence: string } | null,
  bcMode: boolean
): Chance {
  const unknown: Chance = { risk: 'unknown', percent: null, offset: null, belowOne: false };
  // With birth control the model is suppressed: there is no predicted ovulation
  // to measure against, so any number would be invented.
  if (bcMode || !prediction?.ov) return unknown;

  const ov = Date.parse(prediction.ov + 'T00:00:00Z');
  const d = Date.parse(date + 'T00:00:00Z');
  if (!Number.isFinite(ov) || !Number.isFinite(d)) return unknown;

  const offset = Math.round((d - ov) / 864e5);
  const p = BY_OFFSET[offset];
  const percent = p === undefined ? null : Math.round(p * 100);
  const belowOne = p === undefined;

  return {
    risk: p === undefined ? 'low' : p >= 0.27 ? 'high' : p >= 0.08 ? 'medium' : 'low',
    percent: percent ?? 1,
    offset,
    belowOne,
  };
}

// Bar width as a percentage of the peak (33%). Exported so the UI and its test
// agree on the scale.
export function barWidth(c: Chance): number {
  if (c.percent === null) return 0;
  return Math.min(100, Math.round((c.percent / 33) * 100));
}

export const BASELINE_PERCENT = Math.round(BASELINE * 100);
