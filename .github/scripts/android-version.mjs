// Stamp android/app/build.gradle with versionName from package.json and
// versionCode from CI run number (must be a monotonic integer for upgrades).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const ver = pkg.version;
const code = Number(process.env.BUILD_NUMBER || 1);
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
s = s.replace(/versionName\s+"[^"]*"/, `versionName "${ver}"`);
writeFileSync(file, s);
console.log(`android version -> ${ver} (code ${code})`);
