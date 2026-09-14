import { requireUser, buildState } from '../_lib';

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

export async function onRequestGet({ request, env }: any) {
  const user = await requireUser(env, request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  return json(await buildState(env, user.id));
}
