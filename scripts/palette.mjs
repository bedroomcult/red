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
  bg: '#fff8f8', card: '#ffffff', ink: '#2b2230', 'ink-2': '#4a3d52', muted: '#7a707f',
  period: '#f0507a', fertile: '#5bb8e8', ovulation: '#2f8fd0', pms: '#f5a94a', neutral: '#b9a8c9',
  'period-ink': '#ac3957', 'fertile-ink': '#3d7c9c', 'ovulation-ink': '#287bb3',
  'pms-ink': '#8e622b', 'neutral-ink': '#7d7187', 'success-ink': '#33835d', 'danger-ink': '#d14246',
  'rose-soft': '#ffd9e3', amber: '#fdecd8',
};
const DARK = {
  bg: '#16121a', card: '#221c28', ink: '#f6eef4', 'ink-2': '#ded2e0', muted: '#a99fb0',
  period: '#ff6b93', fertile: '#6cc4ee', ovulation: '#4a9fdd', pms: '#f5b366', neutral: '#c4b4d4',
  'period-ink': '#ff9ab4', 'fertile-ink': '#8ed4f5', 'ovulation-ink': '#7cc0ec',
  'pms-ink': '#f5c68f', 'neutral-ink': '#c4b4d4', 'success-ink': '#6fd6a4', 'danger-ink': '#ff8a8e',
  'rose-soft': '#4a2a38', amber: '#3a2c1c',
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
  for (const k of ['period', 'fertile', 'ovulation', 'pms', 'neutral']) check(`${k}-ink on card`, t[k + '-ink'], t.card);
  check('period-ink on rose-soft', t['period-ink'], t['rose-soft']);
  check('pms-ink on amber', t['pms-ink'], t.amber);
  check('success-ink on card', t['success-ink'], t.card);
  check('danger-ink on card', t['danger-ink'], t.card);
  return fails;
}

const lightFails = report('LIGHT', LIGHT);
const darkFails = report('DARK', DARK);

const total = lightFails + darkFails;
console.log(`\n${total === 0 ? 'All pairs pass AA.' : `${total} pair(s) FAIL AA.`}`);
process.exit(total === 0 ? 0 : 1);
