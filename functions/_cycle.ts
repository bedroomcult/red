// Copy of the period-merging helpers from lib/cycle.ts. functions/ must be
// self-contained for the Pages bundler, which does not resolve imports that
// reach outside the functions directory.
// ponytail: keep in sync with lib/cycle.ts.

const DAY = 864e5;
const parse = (d: string) => Date.parse(d + 'T00:00:00Z');

// Two bleeds within this many days are treated as one episode, so logging a new
// start during (or right after) an ongoing period extends it rather than
// creating a second row. Two rows would paint overlapping blocks, reset the
// cycle-day counter mid-bleed, and split one episode across the history.
// ponytail: fixed gap, not user-configurable — 2 days catches a one-day pause
// without swallowing a genuinely separate episode.
export const MERGE_GAP_DAYS = 2;

// The logged period a new start date should extend, if any. Only an ongoing
// period (no end_date) whose range reaches within MERGE_GAP_DAYS of the new
// start qualifies; a finished period followed by a new bleed is a new cycle.
export function periodToExtend<T extends { start_date: string; end_date: string | null; type: string }>(
  periods: T[],
  startDate: string,
  periodLen: number
): T | undefined {
  const s = parse(startDate);
  return periods.find((p) => {
    if (p.type !== 'menstruation') return false;
    if (p.end_date) return false;
    const ps = parse(p.start_date);
    if (s < ps) return false;
    // End of the expected range. A start inside the range gives a negative gap,
    // which is still <= the threshold, so it merges too.
    const paintedEnd = ps + (periodLen - 1) * DAY;
    const gap = Math.round((s - paintedEnd) / DAY);
    return gap <= MERGE_GAP_DAYS;
  });
}
