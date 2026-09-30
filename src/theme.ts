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

// Read a CSS token's live value, so the native bar can never drift from the
// stylesheet. Falls back to a literal if the token is missing.
function token(name: string, fallback: string): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch { return fallback; }
}

// Native status bar follows the app surface: the page background plus icons in
// the opposite tone.
//
// Capacitor's Style enum names the BACKGROUND, not the icon: Style.Dark means
// "light text for dark backgrounds", Style.Light means "dark text for light
// backgrounds". So a light app takes Style.Light (dark icons) and a dark app
// takes Style.Dark (light icons). Getting this backwards is what left white
// icons on a near-white bar.
//
// Fire-and-forget: a slow or missing plugin bridge must never block the theme
// paint.
function syncStatusBar(dark: boolean) {
  if (!Capacitor.isNativePlatform()) return;
  const bg = token('--bg', dark ? '#16121a' : '#fff8f8');
  import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    void StatusBar.setBackgroundColor({ color: bg }).catch(() => {});
    void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
  }).catch(() => {});
}

export const applyTheme = (t: Theme) => {
  document.documentElement.setAttribute('data-theme', t);
  const dark = isDark(t);
  const meta = document.querySelector('meta[name="theme-color"]');
  // The meta must match the bar too, so the PWA chrome and the native bar agree.
  // Read after the attribute is set, so the tokens are already resolved.
  if (meta) meta.setAttribute('content', token('--bg', dark ? '#16121a' : '#fff8f8'));
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
