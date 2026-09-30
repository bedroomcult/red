import { t } from './i18n';
import type { Phase } from '../lib/cycle';

// Cycle dial, per DESIGN.md section 4.1 and the SVG sketch in section 13.
//
// Arcs are drawn around one circle, each phase occupying its span of the cycle
// and coloured by its own hue. Future arcs (predicted period) are drawn at low
// opacity and dashed, so a prediction never reads as a logged fact. A knob
// marks today's position on the ring.
//
// The centre always carries the phase in words as well as colour, so the dial
// is never the only carrier of meaning.
const PHASE_FILL: Record<Phase, string> = {
  period: 'var(--period)',
  fertile: 'var(--fertile)',
  ovulation: 'var(--ovulation)',
  pms: 'var(--pms)',
  neutral: 'var(--neutral)',
  bc: 'var(--neutral)',
};

const PHASE_LABEL: Record<Phase, string> = {
  period: t.phasePeriod,
  fertile: t.phaseFertile,
  ovulation: t.phaseOvulation,
  pms: t.phasePms,
  neutral: t.phaseNeutral,
  bc: t.phaseBc,
};

// One arc of the ring. `from`/`to` are cycle days, 1-based and inclusive.
type Arc = { from: number; to: number; color: string; dashed?: boolean };

export default function CycleRing({ day, total, phase, periodLen = 5, ovDay = null, nextStart = null, label }: {
  // Cycle day, 1-based. null when there is no anchor period yet.
  day: number | null;
  total: number;
  phase: Phase;
  periodLen?: number;
  // Day-of-cycle of the predicted ovulation, when known.
  ovDay?: number | null;
  // Day-of-cycle of the predicted next period start, when known.
  nextStart?: number | null;
  // Centre caption. Defaults to the phase name.
  label?: string;
}) {
  const size = 260;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const cycle = Math.max(1, total);
  const arcLen = (days: number) => (days / cycle) * circumference;
  const rot = (cycleDay: number) => ((cycleDay - 1) / cycle) * 360 - 90;

  const arcs: Arc[] = [];
  if (day !== null) {
    // Logged / current period: day 1 through the configured period length.
    arcs.push({ from: 1, to: Math.min(periodLen, cycle), color: 'var(--period)' });
    // Fertile window: ovulation -5d .. +1d, matching lib/cycle.ts.
    if (ovDay !== null) {
      const lo = Math.max(periodLen + 1, ovDay - 5);
      const hi = Math.min(cycle, ovDay + 1);
      if (hi >= lo) {
        arcs.push({ from: lo, to: hi, color: 'var(--fertile)' });
        arcs.push({ from: ovDay, to: ovDay, color: 'var(--ovulation)' });
      }
    }
    // Predicted next period, dashed and dimmed so it reads as a forecast.
    if (nextStart !== null && nextStart <= cycle) {
      arcs.push({ from: nextStart, to: Math.min(nextStart + periodLen - 1, cycle), color: 'var(--period)', dashed: true });
    }
  }

  // Today's position as an angle on the ring, for the knob.
  const knobAngle = day === null ? null : ((Math.min(day, cycle) - 1) / cycle) * 2 * Math.PI - Math.PI / 2;
  const knob = knobAngle === null ? null : {
    cx: size / 2 + r * Math.cos(knobAngle),
    cy: size / 2 + r * Math.sin(knobAngle),
  };

  return (
    <div className="ring-wrap">
      <svg
        className="ring-svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={day === null ? t.homeNoData : `${PHASE_LABEL[phase]}, ${t.homeCycleDay} ${day}`}
      >
        {/* Track: the neutral phase hue at low opacity, per the spec sketch. */}
        <circle
          className="ring-track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        {arcs.map((a, i) => (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            stroke={a.color}
            strokeDasharray={`${arcLen(a.to - a.from + 1)} ${circumference}`}
            transform={`rotate(${rot(a.from)} ${size / 2} ${size / 2})`}
            opacity={a.dashed ? 0.35 : 1}
            style={a.dashed ? { strokeDasharray: `${arcLen(a.to - a.from + 1)} ${circumference}` } : undefined}
          />
        ))}
        {knob && (
          <circle
            className="ring-knob"
            cx={knob.cx}
            cy={knob.cy}
            r={10}
            fill="#fff"
            stroke={PHASE_FILL[phase]}
            strokeWidth={3}
          />
        )}
      </svg>
      <div className="ring-centre">
        <span className="ring-figure">{day ?? '–'}</span>
        <span className="ring-label">{label ?? PHASE_LABEL[phase]}</span>
      </div>
    </div>
  );
}
