import { apiFetch, readJson } from './api';

// Latest published GitHub release. The repo is public, so this needs no token.
// ponytail: read from the public releases API rather than bundling a manifest —
// one less thing to keep in sync with the release workflow.
const RELEASES_API = 'https://api.github.com/repos/bedroomcult/red/releases/latest';
export const RELEASES_PAGE = 'https://github.com/bedroomcult/red/releases/latest';

export type UpdateInfo = {
  latest: string; // version from the release tag, without the leading v
  url: string; // APK download URL, or the releases page
  notes: string;
};

// Compares dotted numeric versions. Returns true when `latest` is newer than
// `current`. Anything unparseable is treated as "not newer" so a malformed tag
// cannot nag the user forever.
export function isNewer(latest: string, current: string): boolean {
  const parse = (v: string) => v.replace(/^v/, '').split('.').map((n) => Number.parseInt(n, 10));
  const a = parse(latest);
  const b = parse(current);
  if (a.length < 3 || b.length < 3 || [...a, ...b].some((n) => !Number.isFinite(n))) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}

let cached: UpdateInfo | null | undefined;

export async function checkForUpdate(current: string): Promise<UpdateInfo | null> {
  if (cached !== undefined) return cached && isNewer(cached.latest, current) ? cached : null;
  try {
    const r = await apiFetch(RELEASES_API);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await readJson<any>(r);
    const latest = String(j?.tag_name ?? '').replace(/^v/, '');
    if (!latest) throw new Error('no tag_name');
    const apk = (j?.assets ?? []).find((a: any) => typeof a?.name === 'string' && a.name.endsWith('.apk'));
    cached = {
      latest,
      url: apk?.browser_download_url ?? RELEASES_PAGE,
      notes: String(j?.name ?? ''),
    };
  } catch {
    // Offline, rate-limited, or no releases yet: not an error the user needs.
    cached = null;
  }
  return cached && isNewer(cached.latest, current) ? cached : null;
}
