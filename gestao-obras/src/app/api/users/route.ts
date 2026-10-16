import { authedRoute, json, readJson, readQuery } from "@/server/http/handler";
import { createUserSchema, userListQuery } from "@/server/validation/user";
import { createUser, listUsers } from "@/server/services/user.service";

export const GET = authedRoute(async ({ req, actor }) => json({ users: await listUsers(actor, readQuery(req, userListQuery)) }));

export const POST = authedRoute(async ({ req, actor, meta }) => {
  const input = await readJson(req, createUserSchema);
  return json({ user: await createUser(actor, input, meta) }, 201);
});
