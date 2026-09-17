import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// The app icon is generated, not committed as a binary: android/ is not tracked,
// so CI regenerates the launcher icons on every build. If the generator throws,
// the APK silently ships Capacitor's default icon.
const ROOT = new URL('..', import.meta.url).pathname;

function pngSize(file: string): { w: number; h: number } {
  const d = readFileSync(file);
  expect(d.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return { w: d.readUInt32BE(16), h: d.readUInt32BE(20) };
}

describe('web app icons', () => {
  it('ships 192 and 512 px PNGs at the right dimensions', () => {
    expect(pngSize(ROOT + 'public/icon-192.png')).toEqual({ w: 192, h: 192 });
    expect(pngSize(ROOT + 'public/icon-512.png')).toEqual({ w: 512, h: 512 });
  });

  it('declares a maskable icon so Android can crop it safely', () => {
    const m = JSON.parse(readFileSync(ROOT + 'public/manifest.json', 'utf8'));
    expect(m.name).toBe('Red');
    expect(m.icons.some((i: any) => i.purpose === 'maskable')).toBe(true);
    expect(m.icons.some((i: any) => i.sizes === '192x192')).toBe(true);
  });

  it('the tab bar uses SVG icons, not emoji', () => {
    // Emoji render differently per OEM and ignore `color`, so the active-tab
    // accent could not be applied. The tab bar must stay on inline SVG.
    const app = readFileSync(ROOT + 'src/App.tsx', 'utf8');
    expect(app).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    expect(app).toContain('<Icon name=');
  });

  it('the onboarding steps use SVG icons, not emoji', () => {
    const ob = readFileSync(ROOT + 'src/Onboarding.tsx', 'utf8');
    expect(ob).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
    expect(ob).toContain('<Icon name=');
  });

  it('every Icon name used in the app exists in Icon.tsx', () => {
    const icon = readFileSync(ROOT + 'src/Icon.tsx', 'utf8');
    const declared = new Set([...icon.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1]));
    const used = new Set<string>();
    for (const f of ['src/App.tsx', 'src/Onboarding.tsx']) {
      for (const m of readFileSync(ROOT + f, 'utf8').matchAll(/<Icon name="(\w+)"/g)) used.add(m[1]);
    }
    for (const m of readFileSync(ROOT + 'src/Onboarding.tsx', 'utf8').matchAll(/'home'|'calendar'|'insights'|'history'|'settings'/g)) {
      used.add(m[0].replace(/'/g, ''));
    }
    expect(used.size).toBeGreaterThan(0);
    for (const u of used) expect(declared.has(u)).toBe(true);
  });

  it('the generator is wired into the apk job', () => {
    const ci = readFileSync(ROOT + '.github/workflows/ci.yml', 'utf8');
    expect(ci).toContain('scripts/generate-icons.mjs');
  });
});

// Runs the real generator into a scratch tree. Slow (supersampled raster), so it
// covers the failure modes rather than every output size.
describe('generate-icons.mjs', () => {
  const hasAndroid = existsSync(ROOT + 'android/app/src/main/res');

  it('exits non-zero with a clear message when android/ is missing', () => {
    if (hasAndroid) return;
    let failed = false;
    try {
      execFileSync('node', [ROOT + 'scripts/generate-icons.mjs'], { cwd: ROOT, stdio: 'pipe' });
    } catch (e: any) {
      failed = true;
      expect(String(e.stderr)).toContain('cap add android');
    }
    expect(failed).toBe(true);
  });
});
