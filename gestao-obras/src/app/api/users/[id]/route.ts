import { authedRoute, json, readJson } from "@/server/http/handler";
import { updateUserSchema } from "@/server/validation/user";
import { uuid } from "@/server/validation/common";
import { getUser, updateUser } from "@/server/services/user.service";

type P = { id: string };

export const GET = authedRoute<P>(async ({ actor, params }) => json({ user: await getUser(actor, uuid.parse(params.id)) }));

export const PATCH = authedRoute<P>(async ({ req, actor, params, meta }) => {
  const input = await readJson(req, updateUserSchema);
  return json({ user: await updateUser(actor, uuid.parse(params.id), input, meta) });
});
