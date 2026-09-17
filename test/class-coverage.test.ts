import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// A CSS class used by a component but never defined renders unstyled, and nothing
// fails: TypeScript does not check class names, and the build succeeds. That
// happened for real - DaySheet used seven day-head-* classes while the stylesheet
// had none, because a patch anchored on a line another commit had since changed.
// This test closes that gap.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CSS = readFileSync(ROOT + 'src/index.css', 'utf8');

// Classes defined in the stylesheet, including inside compound selectors.
function definedClasses(): Set<string> {
  const out = new Set<string>();
  // Strip comments so commented-out examples do not count as definitions.
  const clean = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of clean.matchAll(/\.([a-zA-Z][\w-]*)/g)) out.add(m[1]);
  return out;
}

// Classes referenced from JSX/TSX via className.
//
// Two sources only: the static prefix before the first interpolation, and string
// literals that are the *result* of a ternary (after ? or :). Reading every quoted
// string also picks up comparison operands such as `conf === 'high'`, which are
// not classes and produced false positives.
function usedClasses(): Map<string, string[]> {
  const used = new Map<string, string[]>();
  const dir = ROOT + 'src';
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.tsx'))) {
    const src = readFileSync(dir + '/' + f, 'utf8');
    const add = (s: string) => {
      for (const c of s.split(/\s+/)) {
        // A trailing dash means the token is a class prefix completed by an
        // interpolation, e.g. `risk-${level}` -> risk-high. Not a class itself.
        if (!/^[a-zA-Z][\w-]*$/.test(c) || c.endsWith('-')) continue;
        const list = used.get(c) ?? [];
        list.push(f);
        used.set(c, list);
      }
    };
    for (const m of src.matchAll(/className=(\{?)([\s\S]*?)\1(?=[\s/>])/g)) {
      const value = m[2];
      // Static prefix, e.g. `btn primary ${...}`.
      add(value.split('${')[0].replace(/[`"{}]/g, ' '));
      // Ternary results: ? 'a' and : 'b'.
      for (const t of value.matchAll(/[?:]\s*'([^']*)'/g)) add(t[1]);
    }
  }
  return used;
}

// Not in the stylesheet on purpose: global utility names and third-party hooks.
const ALLOWED = new Set([
  'app', // defined as `.app`
  'pop', // animation utility
  'on', // state modifier, always combined with a base class
  'active',
  'hidden',
]);

describe('every class used in a component is defined in the stylesheet', () => {
  const defined = definedClasses();
  const used = usedClasses();

  it('finds classes on both sides', () => {
    expect(defined.size).toBeGreaterThan(50);
    expect(used.size).toBeGreaterThan(30);
  });

  it('has no unstyled class', () => {
    const missing: string[] = [];
    for (const [cls, files] of used) {
      if (defined.has(cls) || ALLOWED.has(cls)) continue;
      missing.push(`${cls} (used in ${[...new Set(files)].join(', ')})`);
    }
    expect(missing).toEqual([]);
  });

  it('catches a class that only exists in a component', () => {
    // Sanity check the detector itself, so a broken regex cannot make the suite
    // pass vacuously.
    const fake = 'this-class-does-not-exist';
    expect(defined.has(fake)).toBe(false);
  });
});
