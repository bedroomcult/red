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

  it('every phase text colour passes on the card', () => {
    // The phase hexes are FILL colours: the raw values are far too light for
    // text (fertile #5bb8e8 is 2.2:1). Text uses the -ink variants.
    for (const p of ['period', 'fertile', 'ovulation', 'pms', 'neutral']) {
      const ratio = contrast(token(`${p}-ink`, lightBlock), card);
      expect(ratio, `${p}-ink on card`).toBeGreaterThanOrEqual(AA);
    }
  });

  it('period-ink on rose-soft and pms-ink on amber', () => {
    // Both are text-on-tint pairs. The tints are opaque, so no compositing.
    expect(contrast(token('period-ink', lightBlock), token('rose-soft', lightBlock))).toBeGreaterThanOrEqual(AA);
    expect(contrast(token('pms-ink', lightBlock), token('amber', lightBlock))).toBeGreaterThanOrEqual(AA);
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

  it('every phase text colour passes on the dark card', () => {
    for (const p of ['period', 'fertile', 'ovulation', 'pms', 'neutral']) {
      const ratio = contrast(token(`${p}-ink`, darkBlock), card);
      expect(ratio, `${p}-ink on dark card`).toBeGreaterThanOrEqual(AA);
    }
  });
});

describe('DESIGN.md rules are reflected in the stylesheet', () => {
  it('cards carry a border and a tinted shadow, never a black one', () => {
    const cardRule = /\.card\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(cardRule).toMatch(/border:\s*1px solid var\(--line\)/);
    expect(cardRule).toMatch(/box-shadow:\s*var\(--shadow-1\)/);
    // No raw black shadow in the light theme: shadows are tinted to the rose
    // ground. Dark mode legitimately uses black shadows, so scope to :root.
    const rootBlock = CSS.slice(CSS.indexOf(':root {'), CSS.indexOf('[data-theme="dark"]'));
    expect(rootBlock).not.toMatch(/box-shadow:[^;]*rgba\(0,\s*0,\s*0/);
  });

  it('no font weight above 700', () => {
    // DESIGN.md: 400 body, 500 caption, 600 label, 700 display only.
    const weights = [...CSS.matchAll(/font-weight:\s*(\d{3})/g)].map((m) => Number(m[1]));
    expect(weights.filter((w) => w > 700)).toEqual([]);
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

  it('the dial states its value as text, not colour alone', () => {
    const ring = readFileSync(ROOT + 'src/CycleRing.tsx', 'utf8');
    // The dial is the direction's signature element, so its contract is pinned:
    // per-phase SVG arcs, a visible text figure, and an aria-label carrying the
    // value for screen readers (spec checklist: every colour-coded state needs
    // a non-colour cue).
    expect(ring).toMatch(/strokeDasharray/);
    expect(ring).toMatch(/strokeLinecap="round"/);
    expect(ring).toMatch(/aria-label=/);
    expect(ring).toMatch(/className="ring-figure"/);
    // Predicted arcs are dimmed, so a forecast never reads as a logged fact.
    expect(ring).toMatch(/opacity=\{a\.dashed \?/);
    // Home restates the phase as text beside the dial.
    const home = readFileSync(ROOT + 'src/Home.tsx', 'utf8');
    expect(home).toMatch(/className="ring-phase"/);
    // The dial and the prediction must share one denominator, or the arc and
    // the "in N days" line contradict each other on screen.
    expect(home).toMatch(/const cycleLen = me\.insights\?\.avgCycle/);
    expect(home).toMatch(/total=\{cycleLen\}/);
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
