export type Prediction = { next: string | null; lo: string | null; hi: string | null; ov: string | null; confidence: string; flags: string[] };

export type Period = { id: string; start_date: string; end_date: string | null; flow: string | null; type: 'menstruation' | 'spotting' };

export type Dose = { date: string; taken: boolean };

export type SexLog = { date: string; protected: boolean };

// ponytail: string compare works, dates are YYYY-MM-DD UTC.
const inRange = (d: string, lo: string | null, hi: string | null) =>
  !!lo && !!hi && d >= lo && d <= hi;

function monthCells(year: number, mon: number): (string | null)[] {
  const first = new Date(Date.UTC(year, mon, 1));
  // Mon-start offset
  const off = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, mon + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array(off).fill(null);
  for (let d = 1; d <= days; d++)
    cells.push(`${year}-${String(mon + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  return cells;
}

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
import { localDate } from '../lib/today';
import { t } from './i18n';

export default function Calendar({ year, mon, periods, prediction, selected, onPick, doses = [], sex = [] }: {
  year: number; mon: number; periods: Period[]; prediction: Prediction | null;
  selected: string | null; onPick: (d: string) => void; doses?: Dose[]; sex?: SexLog[];
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
  return (
    <div>
      <div className="grid">
        {['S', 'S', 'R', 'K', 'J', 'S', 'M'].map((d, i) => <div key={i} className="dow">{d}</div>)}
        {cells.map((d, i) => (
          <div key={i} className="day">
            {d && (() => {
              const p = logged.get(d);
              const dose = doseByDate.get(d);
              const sexLog = sexByDate.get(d);
              const cls = inPeriod.has(d) ? 'logged'
                : p ? '' // spotting: plain + dot below
                : inRange(d, predLo, predHi) ? 'pred-period'
                : d === ovDay ? 'pred-ovulation'
                : ovs.has(d) ? 'pred-fertile' : '';
              // The heart turns green when the date falls in the fertile window,
              // matching the green used for the ovulation circle. That is the
              // signal that this day carried pregnancy risk.
              const heartClass = sexLog ? (ovs.has(d) ? 'sex fertile' : 'sex') : '';
              return (
                <button
                  className={`dnum ${cls} ${d === selected ? 'sel' : ''} ${d === todayIso ? 'today' : ''} ${dose ? (dose.taken ? 'dose-taken' : 'dose-missed') : ''} ${heartClass}`}
                  onClick={() => onPick(d)}
                  aria-label={`${new Date(d + 'T00:00:00Z').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}${sexLog ? `, ${t.legendSex}${sexLog.protected ? ` (${t.sexProtected})` : ''}` : ''}`}
                  aria-current={d === todayIso ? 'date' : undefined}
                >
                  {sexLog && (
                    <svg className="heart" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  )}
                  <span className="dnum-num">{inPeriod.has(d) ? '✓' : Number(d.slice(8))}</span>
                </button>
              );
            })()}
            {d && logged.get(d)?.type === 'spotting' && <span className="dot" />}
          </div>
        ))}
      </div>
    </div>
  );
}
