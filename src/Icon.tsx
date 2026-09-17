// Tab bar icons. Inline SVG rather than emoji: emoji render differently on every
// Android OEM (and some render as a colour blob that ignores `color`), so the
// active/inactive state could not be styled reliably.
// 24x24 grid, 1.8 stroke, currentColor so the active tab picks up the accent.
import type { ReactNode } from 'react';

export type IconName = 'home' | 'calendar' | 'insights' | 'history' | 'settings';

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
