// Generates the Red app icon and splash: a white droplet centred on a red
// background. Run after `npx cap add android`, because android/ is not tracked
// in git (CI recreates it on every build).
//
// Pure Node + zlib, no native image dependency: sharp/canvas need prebuilt
// binaries that are not available on every dev machine or CI runner.
//
//   node scripts/generate-icons.mjs            # android + web
//   node scripts/generate-icons.mjs --web-only # public/ PNGs only
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const RED = [229, 72, 77]; // #e5484d, the app's --rose
const WHITE = [255, 255, 255];

// ---------------------------------------------------------------- PNG writer
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// rgba: Uint8ClampedArray of w*h*4
function encodePng(w, h, rgba) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------------- shapes
// Droplet = main circle + wedge, with the sharp apex replaced by a circular arc
// tangent to both wedge sides. Rounding a convex tip means cutting the corner
// off with an arc whose centre lies inside the shape; an inscribed circle would
// sit entirely inside the wedge and change nothing.
//
// With main radius r and apex-arc radius R = k*r:
//   - the sides meet the axis at 30 deg from vertical, so a circle centred
//     d below the sharp apex is tangent to them when d/2 = R, i.e. d = 2R
//   - that arc's top is R below the sharp apex, so the visible height is
//     3r - R = r*(3 - k)
//   - it meets the sides at y = apexY + 1.5R; below that the sides are the
//     boundary, above it the arc is
const TANGENT_X = 0.8660254037844386; // sqrt(3)/2
const APEX_K = 0.28;

function makeDroplet(cx, topY, height, k = APEX_K) {
  const r = height / (3 - k);
  const R = k * r;
  const apexY = topY - R; // the sharp point, before rounding
  const cy = apexY + 2 * r; // main circle centre
  const arcCy = apexY + 2 * R; // apex arc centre
  const sideY = apexY + 1.5 * r; // where the sides meet the main circle
  const arcSideY = apexY + 1.5 * R; // where the arc meets the sides
  return function inside(x, y) {
    const dx = x - cx;
    const dy = y - cy;
    if (dx * dx + dy * dy <= r * r) return true;
    if (y < topY || y > sideY) return false;
    const half =
      y <= arcSideY
        ? Math.sqrt(Math.max(0, R * R - (y - arcCy) * (y - arcCy)))
        : (TANGENT_X * r * (y - apexY)) / (sideY - apexY);
    return Math.abs(x - cx) <= half;
  };
}

// Rounded-rect (or circle when radius >= size/2) coverage test.
function makeRoundedSquare(size, radius) {
  return function inside(x, y) {
    const r = Math.min(radius, size / 2);
    const qx = Math.max(r - x, 0, x - (size - r));
    const qy = Math.max(r - y, 0, y - (size - r));
    return qx * qx + qy * qy <= r * r;
  };
}

function makeCircle(cx, cy, r) {
  return function inside(x, y) {
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= r * r;
  };
}

// ------------------------------------------------------------------ render
const SS = 4; // supersampling per axis

// layers: [{ inside(x,y), color: [r,g,b], alpha: 1 }] painted back to front.
function render(size, height, layers) {
  const rgba = new Uint8ClampedArray(size * height * 4);
  const step = 1 / SS;
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0; // accumulated straight-alpha colour
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) * step;
          const y = py + (sy + 0.5) * step;
          let cr = 0, cg = 0, cb = 0, ca = 0;
          for (const layer of layers) {
            if (!layer.inside(x, y)) continue;
            const [lr, lg, lb] = layer.color;
            const la = layer.alpha ?? 1;
            // source-over
            cr = lr * la + cr * (1 - la);
            cg = lg * la + cg * (1 - la);
            cb = lb * la + cb * (1 - la);
            ca = la + ca * (1 - la);
          }
          r += cr; g += cg; b += cb; a += ca;
        }
      }
      const n = SS * SS;
      const i = (py * size + px) * 4;
      const aAvg = a / n;
      // un-premultiply so edge pixels keep the right colour
      rgba[i] = aAvg > 0 ? r / n / aAvg : 0;
      rgba[i + 1] = aAvg > 0 ? g / n / aAvg : 0;
      rgba[i + 2] = aAvg > 0 ? b / n / aAvg : 0;
      rgba[i + 3] = Math.round(aAvg * 255);
    }
  }
  return encodePng(size, height, rgba);
}

// ------------------------------------------------------------------- assets
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

// Legacy launcher icon (API < 26): red rounded square, white droplet at ~52%.
const ICON_DROP = 0.52; // droplet height as a fraction of the icon size

function legacyIcon(size) {
  const h = size * ICON_DROP;
  return render(size, size, [
    { inside: makeRoundedSquare(size, size * 0.22), color: RED },
    { inside: makeDroplet(size / 2, (size - h) / 2, h), color: WHITE },
  ]);
}

function roundIcon(size) {
  const h = size * ICON_DROP;
  return render(size, size, [
    { inside: makeCircle(size / 2, size / 2, size / 2), color: RED },
    { inside: makeDroplet(size / 2, (size - h) / 2, h), color: WHITE },
  ]);
}

// Adaptive foreground: transparent, drawn on the 108dp canvas but kept inside
// the 66dp safe zone so no launcher mask clips it.
function adaptiveForeground(size) {
  const s = size / 108;
  const h = 40 * s;
  return render(size, size, [
    { inside: makeDroplet(size / 2, (size - h) / 2, h), color: WHITE },
  ]);
}

function splash(w, h) {
  const dropH = Math.min(w, h) * 0.24;
  return render(w, h, [
    { inside: () => true, color: RED },
    { inside: makeDroplet(w / 2, (h - dropH) / 2, dropH), color: WHITE },
  ]);
}

function write(path, buf) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, buf);
}

const webOnly = process.argv.includes('--web-only');

// Web / PWA icons.
write('public/icon-192.png', legacyIcon(192));
write('public/icon-512.png', legacyIcon(512));
console.log('wrote public/icon-192.png, public/icon-512.png');

if (webOnly) process.exit(0);

const RES = 'android/app/src/main/res';
if (!existsSync(RES)) {
  console.error(`no ${RES} — run \`npx cap add android\` first, or pass --web-only`);
  process.exit(1);
}

for (const [name, scale] of Object.entries(DENSITIES)) {
  const dir = join(RES, `mipmap-${name}`);
  write(join(dir, 'ic_launcher.png'), legacyIcon(48 * scale));
  write(join(dir, 'ic_launcher_round.png'), roundIcon(48 * scale));
  write(join(dir, 'ic_launcher_foreground.png'), adaptiveForeground(108 * scale));
}

const SPLASHES = {
  'drawable/splash.png': [480, 320],
  'drawable-port-mdpi/splash.png': [320, 480],
  'drawable-port-hdpi/splash.png': [480, 800],
  'drawable-port-xhdpi/splash.png': [720, 1280],
  'drawable-port-xxhdpi/splash.png': [960, 1600],
  'drawable-port-xxxhdpi/splash.png': [1280, 1920],
  'drawable-land-mdpi/splash.png': [480, 320],
  'drawable-land-hdpi/splash.png': [800, 480],
  'drawable-land-xhdpi/splash.png': [1280, 720],
  'drawable-land-xxhdpi/splash.png': [1600, 960],
  'drawable-land-xxxhdpi/splash.png': [1920, 1280],
};
for (const [path, [w, h]] of Object.entries(SPLASHES)) {
  write(join(RES, path), splash(w, h));
}

// The adaptive icon reads its background from this colour resource; the vector
// below is only used by pre-26 devices that reference @drawable directly.
write(
  join(RES, 'values/ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#E5484D</color>
</resources>
`
);
write(
  join(RES, 'drawable/ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp"
    android:viewportWidth="108" android:viewportHeight="108">
    <path android:fillColor="#E5484D" android:pathData="M0,0h108v108h-108z" />
</vector>
`
);

console.log(`wrote android icons + ${Object.keys(SPLASHES).length} splashes under ${RES}`);
