import { t } from './i18n';

// Week strip, per DESIGN.md section 4.1 zone 2. Seven cells: weekday initial
// above a date number in a circle.
//
// The day marks reuse the SAME classes as the calendar (Calendar.tsx), so a day
// reads identically in both places: logged fill, dashed predicted period, light
// fertile fill, solid peak fill. Today is only the ring, never a red fill — a
// filled circle means "logged period" everywhere else, so filling today would
// claim a log that does not exist.
const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const iso = (d: Date) => d.toISOString().slice(0, 10);

// The Monday-first week containing `anchor`.
function weekOf(anchor: string): string[] {
  const t0 = Date.parse(anchor + 'T00:00:00Z');
  const dow = (new Date(t0).getUTCDay() + 6) % 7; // Monday = 0
  const start = t0 - dow * 864e5;
  return Array.from({ length: 7 }, (_, i) => iso(new Date(start + i * 864e5)));
}

export default function WeekStrip({ selected, today, dayClass, onPick }: {
  selected: string;
  today: string;
  // Maps a date to the same state class the calendar uses (logged, pred-period,
  // pred-fertile, pred-ovulation, or ''). One source of truth for day state.
  dayClass: (d: string) => string;
  onPick: (d: string) => void;
}) {
  const days = weekOf(selected);
  return (
    <div className="week-strip" role="group" aria-label={t.homeCycleDay}>
      {days.map((d, i) => {
        const isToday = d === today;
        const isSel = d === selected;
        const cls = dayClass(d);
        return (
          <button
            key={d}
            className={`week-cell ${isSel ? 'sel' : ''}`}
            onClick={() => onPick(d)}
            aria-current={isToday ? 'date' : undefined}
            aria-pressed={isSel}
          >
            <span className="week-dow" aria-hidden="true">{DOW[i]}</span>
            <span className={`week-num ${cls} ${isToday ? 'today' : ''}`}>{Number(d.slice(8))}</span>
          </button>
        );
      })}
    </div>
  );
}
