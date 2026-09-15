import { requireUser, buildState, jsonResponse } from '../_lib';

const json = jsonResponse;

export async function onRequestGet({ request, env }: any) {
  const user = await requireUser(env, request);
  if (!user) return json({ error: 'unauthorized' }, 401);
  return json(await buildState(env, user.id, request));
}
