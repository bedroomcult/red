export type Prediction = { next: string | null; lo: string | null; hi: string | null; ov: string | null; confidence: string; flags: string[] };

export type Period = { id: string; start_date: string; end_date: string | null; flow: string | null; type: 'menstruation' | 'spotting' };

export type Dose = { date: string; taken: boolean };

export type SexLog = { date: string; protected: boolean };

// ponytail: string compare works, dates are YYYY-MM-DD UTC.
const inRange = (d: string, lo: string | null, hi: string | null) =>
  !!lo && !!hi && d >= lo && d <= hi;

// A calendar month, padded to whole weeks with the neighbouring months' days.
// Padding with the real dates rather than blanks means the last row is not half
// empty, and a day at the start of next month is visible without navigating.
// Each cell carries whether it belongs to the displayed month, so the padding
// can render dimmer.
type Cell = { date: string; inMonth: boolean };

function monthCells(year: number, mon: number): Cell[] {
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  const first = Date.UTC(year, mon, 1);
  const daysInMonth = new Date(Date.UTC(year, mon + 1, 0)).getUTCDate();
  const last = Date.UTC(year, mon, daysInMonth);
  // Monday-first offset.
  const lead = (new Date(first).getUTCDay() + 6) % 7;

  const cells: Cell[] = [];
  for (let i = lead; i > 0; i--) cells.push({ date: iso(first - i * 864e5), inMonth: false });
  for (let d = 0; d < daysInMonth; d++) cells.push({ date: iso(first + d * 864e5), inMonth: true });
  // Pad the final row to a whole week.
  let t = last + 864e5;
  while (cells.length % 7 !== 0) {
    cells.push({ date: iso(t), inMonth: false });
    t += 864e5;
  }
  return cells;
}

const parse = (d: string) => Date.parse(d + 'T00:00:00Z');

function ovSet(ov: string | null): Set<string> {
  if (!ov) return new Set();
  const t = Date.parse(ov + 'T00:00:00Z');
  // Fertile window = ovulation -5d .. +1d (spec).
  return new Set([-5, -4, -3, -2, -1, 0, 1].map((o) => new Date(t + o * 864e5).toISOString().slice(0, 10)));
}

// The peak is one day inside the window, so it needs to read as the same family
// (a green ring) but distinct. A dashed ring, not a fill: a fill already means
// "logged" for periods, and the peak is a prediction.

import { periodDays, predictionStale, dateStale } from '../lib/cycle';
import { useEffect, useRef } from 'react';
import { localDate } from '../lib/today';
import { t } from './i18n';

export default function Calendar({ year, mon, periods, prediction, selected, onPick, doses = [], sex = [], futureStarts = [], periodLen = 5 }: {
  year: number; mon: number; periods: Period[]; prediction: Prediction | null;
  selected: string | null; onPick: (d: string) => void; doses?: Dose[]; sex?: SexLog[];
  // Projected starts for the following cycles. Without these the calendar only
  // ever marks the single next window, so browsing a later month showed nothing.
  futureStarts?: string[];
  // How many days each projected period should paint.
  periodLen?: number;
}) {
  const logged = new Map(periods.map((p) => [p.start_date, p]));
  const doseByDate = new Map(doses.map((d) => [d.date, d]));
  const sexByDate = new Map(sex.map((s) => [s.date, s]));
  // Expand each period start into its full range (end_date, or start+4 default) so
  // in-progress periods paint every day, not just day 1.
  const inPeriod = new Set<string>();
  for (const p of periods) if (p.type === 'menstruation') for (const d of periodDays(p)) inPeriod.add(d);

  // Stale once a logged period overlaps the window, or the window is entirely
  // behind the latest logged period. Hide the WHOLE window (see predictionStale).
  const stale = predictionStale(periods, prediction?.lo ?? null, prediction?.hi ?? null);
  // ovStale: single date, only hides when behind the latest logged period.
  const ovStale = dateStale(periods, prediction?.ov ?? null);
  const ovs = stale || ovStale ? new Set<string>() : ovSet(prediction?.ov ?? null);
  // Peak day, only when the window itself is still valid.
  const ovDay = stale || ovStale ? null : prediction?.ov ?? null;
  const predLo = stale ? null : prediction?.lo ?? null;
  const predHi = stale ? null : prediction?.hi ?? null;
  const cells = monthCells(year, mon);
  const todayIso = localDate();

  // Slide direction: track the previous month so the grid enters from the side
  // the user came from. Right for forward, left for back.
  const prevKey = useRef<string | null>(null);
  const key = `${year}-${mon}`;
  const slideClass = prevKey.current === null || prevKey.current === key
    ? ''
    : key > prevKey.current ? 'slide-next' : 'slide-prev';
  useEffect(() => { prevKey.current = key; }, [key]);

  // Dates to mark as predicted periods. Prefer the multi-cycle projection: it
  // covers later months, which the single next window cannot.
  //
  // A predicted period is a RANGE, not a day. Marking only the start date left
  // cycles 2-6 as a single highlighted cell, so a month view looked like the
  // period was one day long. Every projected start now expands to periodLen
  // days, matching how a logged period paints.
  const future = (futureStarts ?? []).filter((d) => d >= todayIso);
  const predDays = new Set<string>();
  if (future.length) {
    for (const start of future) {
      for (let t = parse(start); t <= parse(start) + (periodLen - 1) * 864e5; t += 864e5) {
        predDays.add(new Date(t).toISOString().slice(0, 10));
      }
    }
  }
  // Keying the grid on year-month restarts the slide animation on every change,
  // in the direction the user moved.
  return (
    <div>
      <div className={`grid ${slideClass}`} key={`${year}-${mon}`}>
        {['S', 'S', 'R', 'K', 'J', 'S', 'M'].map((d, i) => <div key={i} className="dow">{d}</div>)}
        {cells.map((cell, i) => (
          <div key={i} className="day">
            {(() => {
              const d = cell.date;
              const p = logged.get(d);
              const dose = doseByDate.get(d);
              const sexLog = sexByDate.get(d);
              const cls = inPeriod.has(d) ? 'logged'
                : p ? '' // spotting: plain + dot below
                : predDays.has(d) ? 'pred-period'
                : inRange(d, predLo, predHi) ? 'pred-period'
                : d === ovDay ? 'pred-ovulation'
                : ovs.has(d) ? 'pred-fertile' : '';
              // The heart turns green when the date falls in the fertile window,
              // matching the green used for the ovulation circle. That is the
              // signal that this day carried pregnancy risk.
              const heartClass = sexLog ? (ovs.has(d) ? 'sex fertile' : 'sex') : '';
              return (
                <button
                  className={`dnum ${cls} ${cell.inMonth ? '' : 'dim'} ${d === selected ? 'sel' : ''} ${d === todayIso ? 'today' : ''} ${dose ? (dose.taken ? 'dose-taken' : 'dose-missed') : ''} ${heartClass}`}
                  onClick={() => onPick(d)}
                  aria-label={`${new Date(d + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}${sexLog ? `, ${t.legendSex}${sexLog.protected ? ` (${t.sexProtected})` : ''}` : ''}`}
                  aria-current={d === todayIso ? 'date' : undefined}
                >
                  {sexLog && (
                    <svg className="heart" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  )}
                  {/* Always the day number. The checkmark that used to replace it
                      removed the one piece of information the cell exists to show. */}
                  <span className="dnum-num">{Number(d.slice(8))}</span>
                </button>
              );
            })()}
            {logged.get(cell.date)?.type === 'spotting' && <span className="dot" />}
          </div>
        ))}
      </div>
    </div>
  );
}
