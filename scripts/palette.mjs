// Palette contrast report. Run: node scripts/palette.mjs
//
// DESIGN.md requires every text-on-surface pair to pass WCAG AA. This script
// computes the ratios from the same values as src/index.css and prints a
// report, so a palette edit that breaks AA is visible before it ships.
// test/design-tokens.test.ts asserts the same pairs, so CI catches a drift.

const lum = (h) => {
  h = h.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const f = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
// Composite a translucent overlay over an opaque base, for the soft tints.
const over = (hex, alpha, base) => {
  const c = hex.replace('#', '');
  const b = base.replace('#', '');
  return '#' + [0, 2, 4]
    .map((i) => Math.round(parseInt(c.slice(i, i + 2), 16) * alpha + parseInt(b.slice(i, i + 2), 16) * (1 - alpha)))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
};

const AA = 4.5;

const LIGHT = {
  bg: '#fdf8f6', card: '#ffffff', ink: '#241018', 'ink-2': '#4a2f3a', muted: '#7d6068',
  period: '#c8103f', fertile: '#0f7a52', ovulation: '#0b5f40', pms: '#a8410f', neutral: '#7d6068',
  'period-ink': '#a50d34', 'rose-soft': '#fce8ec', 'amber-line': '#7d3808', amber: '#fbe9dd',
};
const DARK = {
  bg: '#160c11', card: '#221319', ink: '#fdf4f6', 'ink-2': '#e6d0d7', muted: '#b39aa2',
  period: '#ff5c82', fertile: '#48cc93', ovulation: '#3bbd88', pms: '#ff9a63', neutral: '#b39aa2',
  'period-ink': '#ff8ba3', 'rose-soft': '#3a1f28', 'amber-line': '#e59062', amber: '#3a2318',
};

function report(name, t) {
  console.log(`\n== ${name} ==`);
  let fails = 0;
  const check = (label, fg, bg) => {
    const r = ratio(fg, bg);
    const ok = r >= AA;
    if (!ok) fails++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${label.padEnd(28)} ${r.toFixed(2)}`);
  };
  for (const k of ['ink', 'ink-2', 'muted']) {
    check(`${k} on bg`, t[k], t.bg);
    check(`${k} on card`, t[k], t.card);
  }
  for (const k of ['period', 'fertile', 'ovulation', 'pms', 'neutral']) check(`${k} on card`, t[k], t.card);
  check('period-ink on rose-soft', t['period-ink'], t['rose-soft']);
  check('amber-line on amber', t['amber-line'], t.amber);
  return fails;
}

const lightFails = report('LIGHT', LIGHT);
const darkFails = report('DARK', DARK);

const total = lightFails + darkFails;
console.log(`\n${total === 0 ? 'All pairs pass AA.' : `${total} pair(s) FAIL AA.`}`);
process.exit(total === 0 ? 0 : 1);
