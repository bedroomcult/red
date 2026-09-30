import { Capacitor, registerPlugin } from '@capacitor/core';

// Home-screen widget bridge, native-only.
//
// The widget needs the next predicted period DATE and the current phase; it
// computes "in N days" itself at paint time. Handing it a precomputed count
// would freeze the moment the app is closed — the widget has to stay right on
// days the user never opens the app.
type CycleWidgetPlugin = {
  setData(o: { nextPeriod: string; phase: string }): Promise<{ ok: boolean }>;
};

const CycleWidget = registerPlugin<CycleWidgetPlugin>('CycleWidget');

// Push the current prediction to the widget. A no-op on web, and silent on any
// native failure: a widget that cannot update must never break the app.
export function syncWidget(nextPeriod: string | null, phase: string): void {
  if (!Capacitor.isNativePlatform()) return;
  void CycleWidget.setData({ nextPeriod: nextPeriod ?? '', phase }).catch(() => {});
}
