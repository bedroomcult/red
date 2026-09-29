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
  bg: '#fff7f9', card: '#ffffff', ink: '#2b1a22', 'ink-2': '#5a3d4a', muted: '#83636f',
  period: '#d91a52', fertile: '#0a7a57', ovulation: '#086a4b', pms: '#ab4d0c', neutral: '#83636f',
  'period-ink': '#b81446', 'rose-soft': '#ffe4ec', 'amber-line': '#803806', amber: '#fdecd8',
};
const DARK = {
  bg: '#191016', card: '#241820', ink: '#fdf3f6', 'ink-2': '#e4cdd7', muted: '#ad919d',
  period: '#ff6b93', fertile: '#4ed4a0', ovulation: '#40c394', pms: '#ffa266', neutral: '#ad919d',
  'period-ink': '#ff9ab4', 'rose-soft': '#3d1f2c', 'amber-line': '#f0a06e', amber: '#3a2517',
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
