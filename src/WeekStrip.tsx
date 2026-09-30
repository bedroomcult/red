import { t } from './i18n';

// Week strip, per DESIGN.md section 4.1 zone 2. Seven equal cells: weekday
// initial above a date number in a circle. Today is a filled circle; logged
// period days carry a coloured dot. Tapping a day selects it.
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const iso = (d: Date) => d.toISOString().slice(0, 10);

// The Monday-first week containing `anchor`.
function weekOf(anchor: string): string[] {
  const t0 = Date.parse(anchor + 'T00:00:00Z');
  const dow = (new Date(t0).getUTCDay() + 6) % 7; // Monday = 0
  const start = t0 - dow * 864e5;
  return Array.from({ length: 7 }, (_, i) => iso(new Date(start + i * 864e5)));
}

export default function WeekStrip({ selected, today, periodDays, onPick }: {
  selected: string;
  today: string;
  // Dates inside a logged period, so the dot only marks real logs.
  periodDays: Set<string>;
  onPick: (d: string) => void;
}) {
  const days = weekOf(selected);
  return (
    <div className="week-strip" role="group" aria-label={t.homeCycleDay}>
      {days.map((d, i) => {
        const isToday = d === today;
        const isSel = d === selected;
        const inPeriod = periodDays.has(d);
        return (
          <button
            key={d}
            className={`week-cell ${isSel ? 'sel' : ''}`}
            onClick={() => onPick(d)}
            aria-current={isToday ? 'date' : undefined}
            aria-pressed={isSel}
          >
            <span className="week-dow" aria-hidden="true">{DOW[i]}</span>
            <span className={`week-num ${isToday ? 'today' : ''}`}>{Number(d.slice(8))}</span>
            {inPeriod && <span className="week-dot" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
