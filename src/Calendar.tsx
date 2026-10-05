export type Prediction = { next: string | null; lo: string | null; hi: string | null; ov: string | null; confidence: string; flags: string[] };

export type Period = { id: string; start_date: string; end_date: string | null; flow: string | null; type: 'menstruation' | 'spotting' };

export type Dose = { date: string; taken: boolean };

export type SexLog = { date: string; protected: boolean };

// ponytail: string compare works, dates are YYYY-MM-DD UTC.

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

// The peak is one day inside the window, so it needs to read as the same family
// but distinct. Its styling lives in index.css (.dnum.pred-ovulation).

import { periodDays } from '../lib/cycle';
import { useEffect, useRef } from 'react';
import { localDate } from '../lib/today';
import { t } from './i18n';
import { makeDayState } from './dayState';

export default function Calendar({ year, mon, periods, prediction, selected, onPick, doses = [], sex = [], futureStarts = [], futureOv = [], periodLen = 5 }: {
  year: number; mon: number; periods: Period[]; prediction: Prediction | null;
  selected: string | null; onPick: (d: string) => void; doses?: Dose[]; sex?: SexLog[];
  // Projected starts for the following cycles. Without these the calendar only
  // ever marks the single next window, so browsing a later month showed nothing.
  futureStarts?: string[];
  // Projected ovulation per future cycle, so later months show their fertile
  // window too instead of only the single next one.
  futureOv?: string[];
  // How many days each projected period should paint.
  periodLen?: number;
}) {
  const logged = new Map(periods.map((p) => [p.start_date, p]));
  // Day-of-bleed per date: walking each logged range once, so a cell can
  // show "day N" without scanning all periods per cell.
  const bleedDay = new Map<string, number>();
  for (const p of periods) {
    if (p.type !== 'menstruation') continue;
    periodDays(p).forEach((date, i) => {
      if (!bleedDay.has(date)) bleedDay.set(date, i + 1);
    });
  }
  const doseByDate = new Map(doses.map((d) => [d.date, d]));
  const sexByDate = new Map(sex.map((s) => [s.date, s]));

  // Day state comes from the shared classifier, so the month grid and the home
  // week strip can never disagree about what a day is. It also returns the
  // fertile-window set, used to colour the sex-log heart.
  const { state: dayState, ovs } = makeDayState({ periods, prediction, futureStarts, futureOv, periodLen });

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
              const state = dayState(d);
              const cls = state === 'spotting' ? '' : state;
              // The mark is a small glyph under the number, not a wrap: the
              // old heart outline fought the phase fill for the same pixels.
              // Fertile green vs pink keeps the risk signal; legend matches.
              const heartClass = sexLog ? (ovs.has(d) ? 'sex fertile' : 'sex') : '';
              const day = bleedDay.get(d);
              return (
                <button
                  className={`dnum ${cls} ${cell.inMonth ? '' : 'dim'} ${d === selected ? 'sel' : ''} ${d === todayIso ? 'today' : ''} ${dose ? (dose.taken ? 'dose-taken' : 'dose-missed') : ''} ${heartClass}`}
                  onClick={() => onPick(d)}
                  aria-label={`${new Date(d + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}${sexLog ? `, ${t.legendSex}${sexLog.protected ? ` (${t.sexProtected})` : ''}` : ''}`}
                  aria-current={d === todayIso ? 'date' : undefined}
                >
                  {sexLog && (
                    <svg className="sex-mark" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 20.5l-1.3-1.2C6 15 3 12.2 3 8.8 3 6 5.1 4 7.8 4c1.5 0 3 .7 4.2 2C13.2 4.7 14.7 4 16.2 4 18.9 4 21 6 21 8.8c0 3.4-3 6.2-7.7 10.5L12 20.5z" />
                    </svg>
                  )}
                  {day !== undefined && (
                    <span className="bleed-day" aria-hidden="true">{day}</span>
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
