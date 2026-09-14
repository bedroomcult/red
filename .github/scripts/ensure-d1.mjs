import { execSync } from 'child_process';
import fs from 'fs';

const acct = process.env.CLOUDFLARE_ACCOUNT_ID;
const tok = process.env.CLOUDFLARE_API_TOKEN;
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
const found = api('GET', '?per_page=100').find((d) => d.name === 'period-db');
if (found) {
  id = found.uuid;
} else {
  id = api('POST', '', { name: 'period-db' }).uuid;
}

let t = fs.readFileSync('wrangler.toml', 'utf8');
t = t.replace(/^database_id = .*$/m, 'database_id = "' + id + '"');
fs.writeFileSync('wrangler.toml', t);
console.log('D1 period-db:', id);
