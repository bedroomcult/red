// Shared cycle statistics. `insights` must use this same definition, or the
// Wawasan screen and the prediction disagree about what the user's cycle is.
export function cycleStats(starts: string[], fallbackCycle = 28) {
  const ds = starts.map((s) => Date.parse(s + 'T00:00:00Z'));
  const fb = Math.min(60, Math.max(15, Math.round(fallbackCycle)));
  // ponytail: 1 period -> assume fb default, low confidence. Real average once 2+ logged.
  const estimated = ds.length < 2;
  let allImplausible = false;
  let cycles: number[];
  if (estimated) {
    cycles = [fb];
  } else {
    cycles = [];
    for (let i = 1; i < ds.length; i++) cycles.push(Math.round((ds[i] - ds[i - 1]) / 86400000));
    // ponytail: drop implausible cycles (mis-taps, spotting logged as period).
    // 15..60d covers real cycles; fallback to the configured length when nothing survives.
    cycles = cycles.filter((c) => c >= 15 && c <= 60);
    if (!cycles.length) { cycles = [fb]; allImplausible = true; }
    cycles = cycles.slice(-6);
  }
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
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
  return {
    ds,
    fb,
    estimated: estimated || allImplausible,
    cycles,
    avg,
    sd,
    range: Math.max(...cycles) - Math.min(...cycles),
    last: ds.length ? ds[ds.length - 1] : null,
  };
}

// EC widens the next prediction and hides ovulation, but only while it is still
// the plausible explanation for what the cycle is doing (spec §5: "next cycle
// normalizes"). It stops applying once a period has been logged after the dose,
// or once more than two cycles have passed with nothing logged.
export function ecDisrupts(ecIntakeAt: string | null, lastStart: string | null, cycleLen = 28): boolean {
  if (!ecIntakeAt) return false;
  const intake = Date.parse(ecIntakeAt);
  if (!Number.isFinite(intake)) return false;
  const len = Math.min(60, Math.max(15, Math.round(cycleLen)));
  if (lastStart) {
    const last = Date.parse(lastStart + 'T00:00:00Z');
    if (Number.isFinite(last) && last > intake) return false; // a bleed since the dose
  }
  return (Date.now() - intake) / 86400000 <= 2 * len;
}

export function predict(starts: string[], opts: {ecType?: string|null, bcMode?: boolean, fallbackCycle?: number}, statsIn?: ReturnType<typeof cycleStats>) {
  if (opts.bcMode) return { next: null, lo: null, hi: null, ov: null, confidence: 'suppressed' as const, flags: ['bc-suppressed'] };
  const stats = statsIn ?? cycleStats(starts, opts.fallbackCycle ?? 28);
  if (!stats.ds.length) return { next: null, lo: null, hi: null, ov: null, confidence: 'low' as const, flags: ['need-more-data'] };
  const { estimated, cycles, avg, sd, range, last } = stats;
  const flags: string[] = [];
  if (estimated) flags.push('estimated');
  const next = new Date(last! + Math.round(avg) * 86400000).toISOString().slice(0, 10);
  let w = Math.max(Math.round(sd), 2);
  if (estimated) w = 5;
  if (opts.ecType === 'LNG') w = 7;
  if (opts.ecType === 'UPA') w = 10;
  const lo = new Date(Date.parse(next) - w * 86400000).toISOString().slice(0, 10);
  const hi = new Date(Date.parse(next) + w * 86400000).toISOString().slice(0, 10);
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
  const confidence = (opts.ecType || estimated ? 'low' : sd < 2 ? 'high' : sd < 4 ? 'med' : 'low') as any;
  if (range > 9) flags.push('irregular');
  if (opts.ecType) flags.push('ec-disrupted');
  return { next, lo, hi, ov, confidence, flags };
}
