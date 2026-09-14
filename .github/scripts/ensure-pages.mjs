import { execSync } from 'child_process';

const acct = process.env.CLOUDFLARE_ACCOUNT_ID;
const tok = process.env.CLOUDFLARE_API_TOKEN;
const NAME = process.env.PAGES_PROJECT || 'cycle-tracker';
if (!acct || !tok) throw new Error('missing Cloudflare env');

function api(method, path, body) {
  const args = ['curl -s -X ' + method, 'https://api.cloudflare.com/client/v4/accounts/' + acct + path];
  args.push("-H 'Authorization: Bearer " + tok + "'");
  if (body) args.push("-H 'Content-Type: application/json'", "-d '" + JSON.stringify(body) + "'");
  const out = execSync(args.join(' '), { encoding: 'utf8', shell: '/bin/bash', stdio: ['ignore', 'pipe', 'pipe'] });
  let j;
  try { j = JSON.parse(out); } catch { throw new Error('Pages API non-JSON: ' + out); }
  return j;
}

const check = api('GET', '/pages/projects/' + NAME);
if (check.success) {
  console.log('Pages project exists:', NAME);
} else if ((check.errors || []).some((e) => e.code === 8000000 || /not found/i.test(e.message || ''))) {
  const created = api('POST', '/pages/projects', { name: NAME, production_branch: 'main' });
  if (!created.success) throw new Error('Pages create failed: ' + JSON.stringify(created.errors));
  console.log('Pages project created:', NAME);
} else {
  throw new Error('Pages check failed: ' + JSON.stringify(check.errors));
}
