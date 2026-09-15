// TEMPORARY diagnostic endpoint. Not for production: it runs an attacker-chosen
// PBKDF2 iteration count, so it is a CPU DoS vector. Delete in the next commit.
// Purpose: find which iteration counts throw in workerd.
export async function onRequestGet({ request }: any) {
  const n = Number(new URL(request.url).searchParams.get('n') ?? 50000);
  const salt = 'probe-salt';
  try {
    const t0 = Date.now();
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode('probe-password'), 'PBKDF2', false, ['deriveBits']);
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: n, hash: 'SHA-256' },
      km,
      256
    );
    return Response.json({ n, ok: true, ms: Date.now() - t0 });
  } catch (e: any) {
    return Response.json({ n, ok: false, name: e?.name, message: String(e?.message ?? e), ms: 0 });
  }
}
