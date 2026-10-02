import { Capacitor, registerPlugin } from '@capacitor/core';

// Home-screen widget bridge, native-only.
//
// The widget needs the next predicted period DATE and the current phase; it
// computes "in N days" itself at paint time. Handing it a precomputed count
// would freeze the moment the app is closed — the widget has to stay right on
// days the user never opens the app.
type CycleWidgetPlugin = {
  setData(o: { nextPeriod: string; phase: string; ov: string }): Promise<{ ok: boolean }>;
  setText(o: { title: string; note: string }): Promise<{ ok: boolean }>;
};

import { loadWidgetText } from './widgetText';

const CycleWidget = registerPlugin<CycleWidgetPlugin>('CycleWidget');

// Push the current prediction to the widget. A no-op on web, and silent on any
// native failure: a widget that cannot update must never break the app.
//
// The ovulation DATE goes across, never a precomputed risk or count: today's
// offset is derived natively at paint time, so the risk shown stays correct on
// days the user never opens the app. Lib/chance.ts owns the curve and its
// caveats; the widget mirrors its buckets and its framing (a chance, never
// "safe") but re-implements the arithmetic in Kotlin, since native code
// cannot import the TypeScript.
export function syncWidget(nextPeriod: string | null, phase: string, ov: string | null): void {
  if (!Capacitor.isNativePlatform()) return;
  void CycleWidget.setData({ nextPeriod: nextPeriod ?? '', phase, ov: ov ?? '' }).catch(() => {});
}

export function syncWidgetText(): void {
  if (!Capacitor.isNativePlatform()) return;
  const { title, note } = loadWidgetText();
  void CycleWidget.setText({ title, note }).catch(() => {});
}
