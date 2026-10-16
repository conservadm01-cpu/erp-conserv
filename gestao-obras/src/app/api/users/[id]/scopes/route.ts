import { authedRoute, json, readJson } from "@/server/http/handler";
import { addScopeSchema } from "@/server/validation/user";
import { uuid } from "@/server/validation/common";
import { addUserScope } from "@/server/services/user.service";

export const POST = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) => {
  const input = await readJson(req, addScopeSchema);
  return json({ scope: await addUserScope(actor, uuid.parse(params.id), input, meta) }, 201);
});
