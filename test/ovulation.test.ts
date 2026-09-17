import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The calendar renders the fertile window as a solid green ring and the peak as
// a dashed one. Both are pure CSS driven by the class list, so the classes and
// their styles are the contract — a rename on one side would silently drop the
// marker rather than fail a typecheck.
//
// fileURLToPath, not URL.pathname: on Windows pathname yields "/C:/...", and
// prefixing that to a relative path produced "C:\C:\...", so every read failed.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CAL = readFileSync(ROOT + 'src/Calendar.tsx', 'utf8');
const CSS = readFileSync(ROOT + 'src/index.css', 'utf8');

describe('ovulation peak marker', () => {
  it('gives the peak its own class, distinct from the window', () => {
    expect(CAL).toContain("'pred-ovulation'");
    expect(CAL).toContain("'pred-fertile'");
  });

  it('checks the peak before the window, so the window cannot swallow it', () => {
    // The peak day is also in ovs, so the order of the ternary decides which
    // class wins.
    const peak = CAL.indexOf("d === ovDay ? 'pred-ovulation'");
    const window = CAL.indexOf("ovs.has(d) ? 'pred-fertile'");
    expect(peak).toBeGreaterThan(-1);
    expect(window).toBeGreaterThan(-1);
    expect(peak).toBeLessThan(window);
  });

  it('styles the peak as a dashed green ring', () => {
    expect(CSS).toMatch(/\.dnum\.pred-ovulation\s*\{[^}]*border-color:\s*var\(--green\)/);
    expect(CSS).toMatch(/\.dnum\.pred-ovulation\s*\{[^}]*border-style:\s*dashed/);
  });

  it('does not use a fill for the peak (a fill already means logged)', () => {
    const block = /\.dnum\.pred-ovulation\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
    expect(block).not.toMatch(/background:/);
  });

  it('hides the peak when the prediction is stale', () => {
    expect(CAL).toMatch(/const ovDay = stale \|\| ovStale \? null/);
  });

  it('has a legend entry and chip for the peak', () => {
    expect(CAL + readFileSync(ROOT + 'src/App.tsx', 'utf8')).toContain('chip ovulation');
    expect(readFileSync(ROOT + 'src/i18n.ts', 'utf8')).toContain('legendOvulation');
    expect(CSS).toMatch(/\.chip\.ovulation\s*\{[^}]*border-style:\s*dashed/);
  });
});
