import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// DESIGN.md is the direction; these tests hold the stylesheet to it. Contrast is
// computed from the real token values rather than trusted, because a palette
// edit that breaks AA is invisible in review and in the build.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CSS = readFileSync(ROOT + 'src/index.css', 'utf8');

function token(name: string, block: string): string {
  const m = new RegExp(`--${name}:\\s*([^;]+);`).exec(block);
  if (!m) throw new Error(`token --${name} not found`);
  return m[1].trim();
}

// The :root block, and the dark override block.
const lightBlock = CSS.slice(CSS.indexOf(':root {'), CSS.indexOf('[data-theme="dark"]'));
const darkBlock = CSS.slice(CSS.indexOf('[data-theme="dark"]'), CSS.indexOf('@media (prefers-color-scheme: dark)'));

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;
const AA_LARGE = 3;

describe('light mode tokens meet WCAG AA', () => {
  const bg = token('bg', lightBlock);
  const card = token('card', lightBlock);

  it('card is a distinct surface from the page background', () => {
    // Cards blended into the page: --card equalled --bg.
    expect(card.toLowerCase()).not.toBe(bg.toLowerCase());
  });

  it('ink on bg and card', () => {
    expect(contrast(token('ink', lightBlock), bg)).toBeGreaterThanOrEqual(AA);
    expect(contrast(token('ink', lightBlock), card)).toBeGreaterThanOrEqual(AA);
  });

  it('ink-2 on bg', () => {
    expect(contrast(token('ink-2', lightBlock), bg)).toBeGreaterThanOrEqual(AA);
  });

  it('muted on bg and card (the F-02 fix)', () => {
    // Was #8a8a8e at 3.44:1, used at 11-13px where 4.5 is required.
    expect(contrast(token('muted', lightBlock), bg)).toBeGreaterThanOrEqual(AA);
    expect(contrast(token('muted', lightBlock), card)).toBeGreaterThanOrEqual(AA);
  });

  it('every phase colour as text on the card', () => {
    for (const p of ['period', 'fertile', 'ovulation', 'pms', 'neutral']) {
      const ratio = contrast(token(p, lightBlock), card);
      expect(ratio, `${p} on card`).toBeGreaterThanOrEqual(AA);
    }
  });

  it('amber-line on amber (the F-06 fix)', () => {
    // Was 1.98:1, carrying the medium-risk badge and the BC/EC warnings. --amber
    // is a translucent overlay, so it is composited over the card first.
    const rgba = /rgba\(([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\)/.exec(token('amber', lightBlock));
    expect(rgba).not.toBeNull();
    const [, r, g, b, a] = rgba!.map(Number);
    const cb = card.replace('#', '');
    const comp = '#' + [r, g, b]
      .map((v, i) => Math.round(v * a + parseInt(cb.slice(i * 2, i * 2 + 2), 16) * (1 - a)))
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('');
    expect(contrast(token('amber-line', lightBlock), comp)).toBeGreaterThanOrEqual(AA);
  });
});

describe('dark mode tokens meet WCAG AA', () => {
  const bg = token('bg', darkBlock);
  const card = token('card', darkBlock);

  it('ink, ink-2 and muted on bg and card', () => {
    for (const t of ['ink', 'ink-2', 'muted']) {
      expect(contrast(token(t, darkBlock), bg), `${t} on bg`).toBeGreaterThanOrEqual(AA);
      expect(contrast(token(t, darkBlock), card), `${t} on card`).toBeGreaterThanOrEqual(AA);
    }
  });

  it('every phase colour as text on the dark card', () => {
    for (const p of ['period', 'fertile', 'ovulation', 'pms', 'neutral']) {
      const ratio = contrast(token(p, darkBlock), card);
      expect(ratio, `${p} on dark card`).toBeGreaterThanOrEqual(AA);
    }
  });
});

describe('DESIGN.md rules are reflected in the stylesheet', () => {
  it('no card shadow; borders do the containment', () => {
    const cardRule = /\.card\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(cardRule).not.toMatch(/box-shadow/);
    expect(cardRule).toMatch(/border:\s*1px solid var\(--line\)/);
  });

  it('no font weight above 600', () => {
    // DESIGN.md: 400 for body, 600 for headings, nothing heavier.
    const weights = [...CSS.matchAll(/font-weight:\s*(\d{3})/g)].map((m) => Number(m[1]));
    expect(weights.filter((w) => w > 600)).toEqual([]);
  });

  it('radius comes from the scale, not one-off values', () => {
    const values = [...CSS.matchAll(/border-radius:\s*([^;]+)/g)].map((m) => m[1].trim());
    for (const v of values) {
      const ok = /^var\(--r/.test(v) || /^50%$/.test(v) || /^(0|var\(--r[^)]*\))( [^;]+)*$/.test(v);
      expect(ok, `off-scale radius: ${v}`).toBe(true);
    }
  });

  it('the calendar cell is fluid and reaches the 44px tap target', () => {
    const rule = /\.dnum\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(rule).toMatch(/max-width:\s*44px/);
    expect(rule).toMatch(/width:\s*100%/);
    expect(rule).not.toMatch(/width:\s*38px/);
  });

  it('the hero is a wash, not a saturated radial field', () => {
    const home = readFileSync(ROOT + 'src/Home.tsx', 'utf8');
    expect(home).not.toMatch(/radial-gradient/);
    expect(home).toMatch(/linear-gradient\(160deg, rgba/);
  });
});

describe('every sheet closes on Escape', () => {
  it('the four panels and the update notice use the shared hook', () => {
    for (const f of ['LogSheet', 'DaySheet', 'BcPanel', 'EcPanel', 'UpdateBanner']) {
      const src = readFileSync(`${ROOT}src/${f}.tsx`, 'utf8');
      expect(src, f).toMatch(/useEscape\(/);
    }
  });
});

describe('theme syncs the status bar and browser chrome', () => {
  it('theme.ts drives the native bar and the theme-color meta', () => {
    const theme = readFileSync(ROOT + 'src/theme.ts', 'utf8');
    expect(theme).toMatch(/status-bar/);
    expect(theme).toMatch(/setBackgroundColor/);
    expect(theme).toMatch(/setStyle/);
    expect(theme).toMatch(/theme-color/);
  });
});
