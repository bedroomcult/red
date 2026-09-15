export type Prediction = { next: string | null; lo: string | null; hi: string | null; ov: string | null; confidence: string; flags: string[] };

export type Period = { id: string; start_date: string; end_date: string | null; flow: string | null; type: 'menstruation' | 'spotting' };

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

import { periodDays, predictionStale } from '../lib/cycle';

export default function Calendar({ year, mon, periods, prediction, selected, onPick }: {
  year: number; mon: number; periods: Period[]; prediction: Prediction | null;
  selected: string | null; onPick: (d: string) => void;
}) {
  const logged = new Map(periods.map((p) => [p.start_date, p]));
  // Expand each period start into its full range (end_date, or start+4 default) so
  // in-progress periods paint every day, not just day 1.
  const inPeriod = new Set<string>();
  for (const p of periods) if (p.type === 'menstruation') for (const d of periodDays(p)) inPeriod.add(d);

  // Stale once a logged period overlaps the window, or the window is entirely
  // behind the latest logged period. Hide the WHOLE window (see predictionStale).
  const stale = predictionStale(periods, prediction?.lo ?? null, prediction?.hi ?? null);
  const ovStale = predictionStale(periods, prediction?.ov ?? null, prediction?.ov ?? null);
  const ovs = stale || ovStale ? new Set<string>() : ovSet(prediction?.ov ?? null);
  const predLo = stale ? null : prediction?.lo ?? null;
  const predHi = stale ? null : prediction?.hi ?? null;
  const cells = monthCells(year, mon);
  const todayIso = new Date().toISOString().slice(0, 10);
  return (
    <div>
      <div className="grid">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i} className="dow">{d}</div>)}
        {cells.map((d, i) => (
          <div key={i} className="day">
            {d && (() => {
              const p = logged.get(d);
              const cls = inPeriod.has(d) ? 'logged'
                : p ? '' // spotting: plain + dot below
                : inRange(d, predLo, predHi) ? 'pred-period'
                : ovs.has(d) ? 'pred-fertile' : '';
              return (
                <button
                  className={`dnum ${cls} ${d === selected ? 'sel' : ''} ${d === todayIso ? 'today' : ''}`}
                  style={d === selected ? { outline: '2px solid #111' } : undefined}
                  onClick={() => onPick(d)}
                  aria-label={d}
                >{inPeriod.has(d) ? '✓' : Number(d.slice(8))}</button>
              );
            })()}
            {d && logged.get(d)?.type === 'spotting' && <span className="dot" />}
          </div>
        ))}
      </div>
    </div>
  );
}
