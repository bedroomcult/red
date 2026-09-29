import { t } from './i18n';
import type { Phase } from '../lib/cycle';

// Cycle ring: the home screen's anchor, Flo-style. One SVG circle drawn as a
// progress arc, where the arc length is the current cycle day over the cycle
// length. The arc colour is the phase colour; the track is the soft rose.
//
// The phase is also rendered as text beside the ring, so colour is never the
// only carrier of meaning (colour-blind and screen-reader safety).
const PHASE_COLOR: Record<Phase, string> = {
  period: 'var(--period)',
  fertile: 'var(--fertile)',
  ovulation: 'var(--ovulation)',
  pms: 'var(--pms)',
  neutral: 'var(--muted)',
  bc: 'var(--muted)',
};

export default function CycleRing({ day, total, phase }: {
  // Cycle day, 1-based. null when there is no anchor period yet.
  day: number | null;
  total: number;
  phase: Phase;
}) {
  const size = 208;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  // Fill toward the cycle length; clamp so a long cycle cannot overflow the
  // ring, and a missing anchor shows an empty track rather than a full ring.
  const ratio = day === null ? 0 : Math.max(0, Math.min(1, day / Math.max(1, total)));
  const offset = circumference * (1 - ratio);

  return (
    <div className="ring-wrap">
      <svg
        className="ring-svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={day === null ? t.homeNoData : `${t.homeCycleDay} ${day}`}
      >
        <circle
          className="ring-track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="ring-arc"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ stroke: PHASE_COLOR[phase] }}
        />
      </svg>
      <div className="ring-centre">
        <span className="ring-figure">{day ?? '–'}</span>
        <span className="ring-label">{t.homeCycleDay}</span>
      </div>
    </div>
  );
}
