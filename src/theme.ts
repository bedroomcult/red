// Theme: 'light' | 'dark' | 'system'. Sets data-theme on <html>.
export type Theme = 'light' | 'dark' | 'system';
const KEY = 'pt.theme';

export const loadTheme = (): Theme => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'dark' || v === 'light' || v === 'system' ? v : 'system';
  } catch { return 'system'; }
};

export const applyTheme = (t: Theme) => {
  document.documentElement.setAttribute('data-theme', t);
  const meta = document.querySelector('meta[name="theme-color"]');
  const dark = t === 'dark' || (t === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  if (meta) meta.setAttribute('content', dark ? '#101013' : '#e5484d');
};

export const saveTheme = (t: Theme) => {
  try { localStorage.setItem(KEY, t); } catch { /* ignore */ }
  applyTheme(t);
};
