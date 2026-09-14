import { execSync } from 'child_process';
import fs from 'fs';

const acct = process.env.CLOUDFLARE_ACCOUNT_ID;
const tok = process.env.CLOUDFLARE_API_TOKEN;
const DB_NAME = process.env.D1_DB_NAME || 'period-db';
if (!acct || !tok) throw new Error('missing Cloudflare env');

function api(method, path, body) {
  const args = [
    'curl -s -X ' + method,
    'https://api.cloudflare.com/client/v4/accounts/' + acct + '/d1/database' + (path || ''),
    "-H 'Authorization: Bearer " + tok + "'",
  ];
  if (body) args.push("-H 'Content-Type: application/json'", "-d '" + JSON.stringify(body) + "'");
  const out = execSync(args.join(' '), { encoding: 'utf8', shell: '/bin/bash', stdio: ['ignore', 'pipe', 'pipe'] });
  let j;
  try { j = JSON.parse(out); } catch { throw new Error('D1 API non-JSON: ' + out); }
  if (!j.success) throw new Error('D1 API failed: ' + out);
  return j.result;
}

let id = null;
const all = api('GET', '?per_page=100');
const found = all.find((d) => d.name === DB_NAME);
if (found) {
  id = found.uuid;
} else {
  try {
    id = api('POST', '', { name: DB_NAME }).uuid;
  } catch (e) {
    // Account at D1 limit: surface existing DB names so a reusable one can be picked via D1_DB_NAME secret.
    throw new Error(
      'Cannot create D1 "' + DB_NAME + '": ' + e.message +
      ' Existing DBs: [' + all.map((d) => d.name).join(', ') + '].' +
      ' Set repo secret D1_DB_NAME to an existing DB to reuse it, or delete one.'
    );
  }
}

let t = fs.readFileSync('wrangler.toml', 'utf8');
t = t.replace(/^database_id = .*$/m, 'database_id = "' + id + '"');
fs.writeFileSync('wrangler.toml', t);
console.log('D1 ' + DB_NAME + ':', id);
