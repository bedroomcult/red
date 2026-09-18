// Shared cycle statistics. `insights` must use this same definition, or the
// Wawasan screen and the prediction disagree about what the user's cycle is.
export function cycleStats(starts: string[], fallbackCycle = 28) {
  const ds = starts.map((s) => Date.parse(s + 'T00:00:00Z'));
  const fb = Math.min(60, Math.max(15, Math.round(fallbackCycle)));
  // ponytail: 1 period -> assume fb default, low confidence. Real average once 2+ logged.
  const estimated = ds.length < 2;
  let allImplausible = false;
  let cycles: number[];
  // Gaps that were logged but rejected as cycle lengths. Kept so the caller can
  // tell "no data yet" apart from "data exists but the cycle was disrupted" -
  // previously both collapsed into estimated=true and the disruption vanished.
  let rejected: number[] = [];
  if (estimated) {
    cycles = [fb];
  } else {
    const raw: number[] = [];
    for (let i = 1; i < ds.length; i++) raw.push(Math.round((ds[i] - ds[i - 1]) / 86400000));
    // ponytail: drop implausible cycles (mis-taps, spotting logged as period).
    // 15..60d covers real cycles; fallback to the configured length when nothing survives.
    cycles = raw.filter((c) => c >= 15 && c <= 60);
    rejected = raw.filter((c) => c < 15 || c > 60);
    if (!cycles.length) { cycles = [fb]; allImplausible = true; }
    cycles = cycles.slice(-6);
  }
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  // Spread is measured from every valid gap BEFORE any outlier is dropped. A 60-day
  // cycle on a PCOS profile is data, not noise, and dropping it first hid the very
  // variability the window exists to cover.
  const observedRange = cycles.length ? Math.max(...cycles) - Math.min(...cycles) : 0;

  // The centre is the mean of the recent gaps, with a single >2 SD outlier
  // removed. Median was tried and scored identically: once the outlier is gone the
  // mean is already robust, so the simpler rule stays.
  let avg = mean(cycles);
  let sd = Math.sqrt(mean(cycles.map((c) => (c - avg) ** 2)));
  if (cycles.length >= 4) {
    const out = cycles.filter((c) => Math.abs(c - avg) > 2 * sd);
    if (out.length === 1) {
      cycles = cycles.filter((c) => c !== out[0]);
      avg = mean(cycles);
      sd = Math.sqrt(mean(cycles.map((c) => (c - avg) ** 2)));
    }
  }

  // Window padding scales with how variable the cycles actually are, rather than
  // with the sample count. A fixed pad gave a PCOS profile (spread 17 days) the
  // same 3-day margin as a regular one, and a leave-one-out backtest put small
  // samples at 33% coverage. Scaling to the spread lifted overall coverage from
  // 95% to 98% while NARROWING the window for regular cycles.
  //
  // Floor of 1 day: a perfectly regular cycle still deserves a little slack.
  const pad = Math.max(1, Math.round(observedRange * 0.25));

  // With one gap there is no observed spread to scale from, so the configured
  // cycle length supplies a floor. A single sample cannot measure variation, and
  // predicting from it alone missed the third cycle in most backtest profiles.
  //
  // 0.25 of the configured length, chosen by sweeping the multiplier: 0.15 left
  // mild and short cycles at 50% coverage, and anything above 0.25 only widened
  // the window without covering another cycle.
  const oneSampleFloor = cycles.length < 2 ? Math.round(fb * 0.25) : 0;
  const effPad = Math.max(pad, oneSampleFloor);

  const cycleLo = Math.max(15, Math.min(...cycles) - effPad);
  const cycleHi = Math.min(60, Math.max(...cycles) + effPad);
  return {
    ds,
    fb,
    estimated: estimated || allImplausible,
    rejected,
    cycles,
    avg,
    sd,
    pad: effPad,
    cycleLo,
    cycleHi,
    spread: cycleHi - cycleLo,
    range: observedRange,
    last: ds.length ? ds[ds.length - 1] : null,
  };
}

// A bleed this soon after the dose is the expected withdrawal bleed, not a return
// to a normal cycle. Treating it as normalization hid the disruption: the user
// saw a "regular" cycle right after taking emergency contraception.
export const WITHDRAWAL_WINDOW_DAYS = 10;

// EC widens the next prediction and hides ovulation, but only while it is still
// the plausible explanation for what the cycle is doing (spec §5: "next cycle
// normalizes"). It stops applying once a cycle has clearly resumed - a period
// logged well after the dose, past the withdrawal-bleed window - or once more
// than two cycles have passed.
export function ecDisrupts(ecIntakeAt: string | null, lastStart: string | null, cycleLen = 28): boolean {
  if (!ecIntakeAt) return false;
  const intake = Date.parse(ecIntakeAt);
  if (!Number.isFinite(intake)) return false;
  const len = Math.min(60, Math.max(15, Math.round(cycleLen)));
  if (lastStart) {
    const last = Date.parse(lastStart + 'T00:00:00Z');
    // A bleed more than the withdrawal window after the dose is a real cycle
    // resuming, so the disruption is over.
    if (Number.isFinite(last) && last > intake && (last - intake) / 86400000 > WITHDRAWAL_WINDOW_DAYS) return false;
  }
  return (Date.now() - intake) / 86400000 <= 2 * len;
}

export function predict(starts: string[], opts: {ecType?: string|null, bcMode?: boolean, fallbackCycle?: number, today?: string}, statsIn?: ReturnType<typeof cycleStats>) {
  if (opts.bcMode) return { next: null, lo: null, hi: null, ov: null, confidence: 'suppressed' as const, flags: ['bc-suppressed'] };
  const stats = statsIn ?? cycleStats(starts, opts.fallbackCycle ?? 28);
  if (!stats.ds.length) return { next: null, lo: null, hi: null, ov: null, confidence: 'low' as const, flags: ['need-more-data'] };
  const { estimated, rejected, cycles, avg, sd, cycleLo, cycleHi, spread, range, last } = stats;
  const flags: string[] = [];
  if (estimated) flags.push('estimated');
  // Advance past any cycles that have already elapsed. Anchoring on the last
  // logged period alone produced a "next period" in the past for anyone who had
  // not logged recently, which the UI then showed as the upcoming date.
  const step = Math.max(1, Math.round(avg));
  let nextMs = last! + step * 86400000;
  if (opts.today) {
    const todayMs = Date.parse(opts.today + 'T00:00:00Z');
    if (Number.isFinite(todayMs)) {
      while (nextMs < todayMs) nextMs += step * 86400000;
    }
  }
  const next = new Date(nextMs).toISOString().slice(0, 10);
  // Window comes from the observed cycle range (see cycleStats), not the SD.
  let loOff = avg - cycleLo;
  let hiOff = cycleHi - avg;
  if (estimated) { loOff = 5; hiOff = 5; }
  // Emergency contraception widens further; take the wider of the two.
  if (opts.ecType === 'LNG') { loOff = Math.max(loOff, 7); hiOff = Math.max(hiOff, 7); }
  if (opts.ecType === 'UPA') { loOff = Math.max(loOff, 10); hiOff = Math.max(hiOff, 10); }
  const lo = new Date(Date.parse(next) - loOff * 86400000).toISOString().slice(0, 10);
  const hi = new Date(Date.parse(next) + hiOff * 86400000).toISOString().slice(0, 10);
  // Ovulation = next period - 14d (luteal phase). On short cycles that lands
  // inside the just-logged period, which then reads as "no fertile window".
  // Clamp to the earliest plausible ovulation (day 8 of the cycle).
  let ov: string | null = null;
  if (!opts.ecType) {
    let ovMs = Date.parse(next) - 14 * 86400000;
    const minOv = last! + 7 * 86400000;
    if (ovMs < minOv) ovMs = minOv;
    ov = new Date(ovMs).toISOString().slice(0, 10);
  }
  const confidence = (opts.ecType || estimated ? 'low' : range <= 5 ? 'high' : range <= 9 ? 'med' : 'low') as any;
  // Flag on the observed spread, not the padded window: padding exists to widen
  // coverage, and counting it here would call a 26-32 day cycle irregular.
  if (range > 9) flags.push('irregular');
  // A logged gap too short to be a cycle is a disruption, not nothing. Without
  // this the app reported a perfectly regular cycle right after emergency
  // contraception, because the short gap had been filtered out silently. Kept as
  // its own flag so the copy can say why the cycle looks irregular.
  if (rejected.length) flags.push('disrupted');
  if (opts.ecType) flags.push('ec-disrupted');
  return { next, lo, hi, ov, confidence, flags };
}

// Why a specific date carries the prediction it does.
//
// The calendar paints a ring and the day sheet used to state the conclusion
// ("this day falls in the predicted window") without the reasoning. The user
// cannot tell a 2-day window from six logged cycles apart from a 10-day window
// from two, and those deserve different trust.
//
// Returns structured facts, not prose. The UI renders them through i18n, so a
// null field means "that reason does not apply" rather than an empty string.
export type PredictionReason = {
  kind: 'bc' | 'no-data' | 'in-window' | 'fertile' | 'ovulation' | 'outside';
  // Where the date sits relative to the predicted period.
  daysFromNext: number | null;
  // The window bounds, so the UI can state them rather than a vague "range".
  windowLo: string | null;
  windowHi: string | null;
  windowDays: number | null;
  // How many observed cycles fed the average, and what that average was.
  observedCycles: number;
  avgCycle: number | null;
  // True when the average is the configured fallback, not measured data.
  estimated: boolean;
  // Observed cycle spread, in days. Wider spread means less certain.
  spread: number | null;
  irregular: boolean;
  ecType: string | null;
  // The ovulation date and whether this date is in the fertile window.
  ov: string | null;
  inFertile: boolean;
};

const DAY_MS = 864e5;

export function explainPrediction(
  date: string,
  starts: string[],
  pred: { next: string | null; lo: string | null; hi: string | null; ov: string | null; confidence: string; flags: string[] },
  opts: { ecType?: string | null; bcMode?: boolean; fallbackCycle?: number; periodLen?: number } = {},
  statsIn?: ReturnType<typeof cycleStats>
): PredictionReason {
  const stats = statsIn ?? cycleStats(starts, opts.fallbackCycle ?? 28);
  const dateMs = Date.parse(date + 'T00:00:00Z');
  const base = {
    daysFromNext: null as number | null,
    windowLo: pred.lo,
    windowHi: pred.hi,
    windowDays: pred.lo && pred.hi
      ? Math.round((Date.parse(pred.hi + 'T00:00:00Z') - Date.parse(pred.lo + 'T00:00:00Z')) / DAY_MS) + 1
      : null,
    observedCycles: stats.estimated ? 0 : stats.cycles.length,
    avgCycle: stats.estimated ? null : Math.round(stats.avg),
    estimated: stats.estimated,
    spread: stats.estimated ? null : stats.range,
    irregular: pred.flags.includes('irregular'),
    ecType: opts.ecType ?? null,
    ov: pred.ov,
    inFertile: false,
  };

  if (opts.bcMode) {
    // Cycle stats describe a natural cycle. While contraception suppresses the
    // prediction the average is not what is driving anything, so reporting it
    // would suggest a forecast that is not being made.
    return { ...base, kind: 'bc', inFertile: false, observedCycles: 0, avgCycle: null, spread: null, estimated: true };
  }
  if (!pred.next || !stats.last) return { ...base, kind: 'no-data' };

  const nextMs = Date.parse(pred.next + 'T00:00:00Z');

  // The predicted window is checked before the fertile window, matching the
  // calendar's own precedence: a date in both reads as the predicted period.
  if (pred.lo && pred.hi && date >= pred.lo && date <= pred.hi) {
    return { ...base, kind: 'in-window', daysFromNext: Math.round((dateMs - nextMs) / DAY_MS) };
  }

  if (pred.ov) {
    const o = Date.parse(pred.ov + 'T00:00:00Z');
    // Same window the calendar paints: ovulation -5d .. +1d.
    if (dateMs >= o - 5 * DAY_MS && dateMs <= o + DAY_MS) {
      return { ...base, kind: date === pred.ov ? 'ovulation' : 'fertile', inFertile: true };
    }
  }

  return { ...base, kind: 'outside', daysFromNext: Math.round((dateMs - nextMs) / DAY_MS) };
}

// ponytail: assert self-check, run with `node --experimental-strip-types lib/predict.ts`.
if (typeof process !== 'undefined' && process.argv?.[1]?.endsWith('predict.ts')) {
  const starts = ['2026-08-09', '2026-09-06'];
  const p = predict(starts, { fallbackCycle: 28 });
  const inWin = explainPrediction(p.lo!, starts, p);
  console.assert(inWin.kind === 'in-window', 'window kind ' + inWin.kind);
  console.assert(inWin.observedCycles === 1, 'observed ' + inWin.observedCycles);
  const ovDay = explainPrediction(p.ov!, starts, p);
  console.assert(ovDay.kind === 'ovulation', 'ovulation kind ' + ovDay.kind);
  console.assert(ovDay.inFertile === true, 'ovulation fertile');
  const outside = explainPrediction('2026-09-01', starts, p);
  console.assert(outside.kind === 'outside', 'outside kind ' + outside.kind);
  const bc = explainPrediction('2026-09-01', starts, { next: null, lo: null, hi: null, ov: null, confidence: 'suppressed', flags: [] }, { bcMode: true });
  console.assert(bc.kind === 'bc', 'bc kind ' + bc.kind);
  const none = explainPrediction('2026-09-01', [], { next: null, lo: null, hi: null, ov: null, confidence: 'low', flags: [] });
  console.assert(none.kind === 'no-data', 'no-data kind ' + none.kind);
  console.log('predict.ts self-check passed');
}
