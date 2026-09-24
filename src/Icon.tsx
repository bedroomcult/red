// Tab bar icons. Inline SVG rather than emoji: emoji render differently on every
// Android OEM (and some render as a colour blob that ignores `color`), so the
// active/inactive state could not be styled reliably.
// 24x24 grid, 1.8 stroke, currentColor so the active tab picks up the accent.
import type { ReactNode } from 'react';

export type IconName = 'home' | 'calendar' | 'insights' | 'history' | 'settings' | 'check' | 'cross' | 'dash' | 'droplet' | 'info' | 'pulse' | 'pencil' | 'pill' | 'heart';

const PATHS: Record<IconName, ReactNode> = {
  // Heart, matching the sex-log marker.
  home: <path d="M12 20.5l-1.3-1.2C6 15 3 12.2 3 8.8 3 6 5.1 4 7.8 4c1.5 0 3 .7 4.2 2C13.2 4.7 14.7 4 16.2 4 18.9 4 21 6 21 8.8c0 3.4-3 6.2-7.7 10.5L12 20.5z" />,
  // Calendar sheet with a marked day.
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none" />
    </>
  ),
  // Bar chart.
  insights: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  // Clock with an arrow, i.e. history.
  history: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3 4v4h4" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  // Droplet, for the period quick-log card.
  droplet: <path d="M12 3.5c2.8 3.7 5.5 6.6 5.5 10a5.5 5.5 0 1 1-11 0c0-3.4 2.7-6.3 5.5-10z" />,
  // Lowercase i in a circle, for the static verdict card.
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5" />
      <circle cx="12" cy="7.8" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  // Pulse line, for the symptoms card.
  pulse: <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />,
  // Pencil, for the note card.
  pencil: (
    <>
      <path d="M4 20l1-4.5L16.5 4l3.5 3.5L8.5 19 4 20z" />
      <path d="M14.5 6l3.5 3.5" />
    </>
  ),
  // Capsule, for the pill card.
  pill: (
    <g transform="rotate(-45 12 12)">
      <rect x="5" y="9" width="14" height="6" rx="3" />
      <path d="M12 9v6" />
    </g>
  ),
  // Heart, for the sex card. Same marker as the home tab.
  heart: <path d="M12 20.5l-1.3-1.2C6 15 3 12.2 3 8.8 3 6 5.1 4 7.8 4c1.5 0 3 .7 4.2 2C13.2 4.7 14.7 4 16.2 4 18.9 4 21 6 21 8.8c0 3.4-3 6.2-7.7 10.5L12 20.5z" />,
  // Segmented-control marks: taken, missed, clear. Simple strokes so they read
  // at 16px inside a small button.
  check: <path d="M4 12.5l5 5L20 6.5" />,
  cross: <path d="M6 6l12 12M18 6L6 18" />,
  dash: <path d="M5 12h14" />,
  // Gear.
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5l1.6 2.2 2.7-.5.6 2.7 2.4 1.3-1.1 2.5 1.1 2.5-2.4 1.3-.6 2.7-2.7-.5L12 21.5l-1.6-2.2-2.7.5-.6-2.7-2.4-1.3 1.1-2.5-1.1-2.5 2.4-1.3.6-2.7 2.7.5z" />
    </>
  ),
};

export default function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
