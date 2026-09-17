// Estimated pregnancy chance for a given day, derived from the predicted fertile
// window. This is a calendar-model estimate, NOT a fertility test: it assumes a
// 14-day luteal phase and a regular cycle, so it can be wrong by several days.
//
// Safety framing matters more than precision here. The output is deliberately
// asymmetric: "high" is stated plainly, but a low estimate is never presented as
// safe for unprotected sex, because no calendar method is reliable enough to
// claim that. See SAFE_NOTE in i18n.
export type Risk = 'high' | 'medium' | 'low' | 'unknown';

export type Chance = {
  risk: Risk;
  // Day offset from the predicted ovulation day; 0 is the peak.
  offset: number | null;
};

// Relative conception probability by cycle day around ovulation. Values are the
// widely-cited Watson/Wilcox pattern: a single day of peak chance, a sharp
// decline after ovulation, and a gradual rise over the preceding days.
// ponytail: fixed curve, not calibrated to the user's data — calibrating it
// would need real outcomes the app does not collect.
const BY_OFFSET: Record<number, number> = {
  '-5': 0.1,
  '-4': 0.16,
  '-3': 0.22,
  '-2': 0.3,
  '-1': 0.35,
  '0': 0.4, // peak
  '1': 0.15,
};

export function pregnancyChance(
  date: string,
  prediction: { ov: string | null; confidence: string } | null,
  bcMode: boolean
): Chance {
  // On birth control the whole model is suppressed: there is no predicted
  // ovulation to measure against, so no estimate is honest.
  if (bcMode || !prediction?.ov) return { risk: 'unknown', offset: null };
  const ov = Date.parse(prediction.ov + 'T00:00:00Z');
  const d = Date.parse(date + 'T00:00:00Z');
  if (!Number.isFinite(ov) || !Number.isFinite(d)) return { risk: 'unknown', offset: null };
  const offset = Math.round((d - ov) / 864e5);
  const p = BY_OFFSET[offset];
  if (p === undefined) return { risk: 'low', offset };
  if (p >= 0.3) return { risk: 'high', offset };
  if (p >= 0.15) return { risk: 'medium', offset };
  return { risk: 'low', offset };
}

// The bar width, as a percentage. Exported so the UI and its test agree.
export function chancePercent(c: Chance): number {
  if (c.risk === 'unknown' || c.offset === null) return 0;
  return Math.round((BY_OFFSET[c.offset] ?? 0.02) * 100);
}
