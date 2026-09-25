// Theme: 'light' | 'dark' | 'system'. Sets data-theme on <html> and keeps
// the native Android status bar + PWA theme-color on the matching surface.
import { Capacitor } from '@capacitor/core';

export type Theme = 'light' | 'dark' | 'system';
const KEY = 'pt.theme';

export const loadTheme = (): Theme => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' || v === 'light' || v === 'system' ? v : 'system';
  } catch { return 'system'; }
};

const isDark = (t: Theme) =>
  t === 'dark' || (t === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);

// Native status bar follows the app surface: cream bg + dark icons in light,
// near-black bg + light icons in dark. Fire-and-forget: a slow or missing
// plugin bridge must never block the theme paint. Capacitor `Style` names the
// *icon* color, so dark mode takes Style.Light (white icons).
function syncStatusBar(dark: boolean) {
  if (!Capacitor.isNativePlatform()) return;
  import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    void StatusBar.setBackgroundColor({ color: dark ? '#1a1917' : '#f7f4ed' }).catch(() => {});
    void StatusBar.setStyle({ style: dark ? Style.Light : Style.Dark }).catch(() => {});
  }).catch(() => {});
}

export const applyTheme = (t: Theme) => {
  document.documentElement.setAttribute('data-theme', t);
  const dark = isDark(t);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#1a1917' : '#f7f4ed');
  syncStatusBar(dark);
};

// Re-resolve the stored theme when the OS flips (matters only for 'system').
// Single module-level subscription; the media query object is stable.
let watching = false;
function watchSystem() {
  if (watching) return;
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  if (!mq?.addEventListener) return;
  watching = true;
  mq.addEventListener('change', () => applyTheme(loadTheme()));
}

export const saveTheme = (t: Theme) => {
  try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
  applyTheme(t);
};

// Start watching on first import; applyTheme itself runs from App on mount.
watchSystem();
