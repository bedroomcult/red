// Stamp android/app/build.gradle with the version from package.json.
// versionName = X.Y.Z, versionCode = X*10000 + Y*100 + Z so it is a monotonic
// integer (Android requires each release to have a strictly higher code).
// ponytail: derived, not stored — one source of truth, package.json.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(pkg.version);
if (!m) {
  console.error(`package.json version "${pkg.version}" is not X.Y.Z`);
  process.exit(1);
}
const [, major, minor, patch] = m.map(Number);
const code = major * 10000 + minor * 100 + patch;
if (code > 2100000000) {
  console.error(`versionCode ${code} exceeds the Android maximum`);
  process.exit(1);
}

const file = 'android/app/build.gradle';
if (!existsSync(file)) {
  console.log('no android dir yet, skipping version stamp');
  process.exit(0);
}

let s = readFileSync(file, 'utf8');
if (!/versionCode\s+\d+/.test(s) || !/versionName\s+"[^"]*"/.test(s)) {
  console.error('could not find versionCode/versionName in ' + file);
  process.exit(1);
}
s = s.replace(/versionCode\s+\d+/, `versionCode ${code}`);
s = s.replace(/versionName\s+"[^"]*"/, `versionName "${pkg.version}"`);
writeFileSync(file, s);
console.log(`android version -> ${pkg.version} (code ${code})`);
