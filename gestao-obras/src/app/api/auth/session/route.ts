import { json, partialRoute } from "@/server/http/handler";
import { buildActor } from "@/server/auth/actor";
import { allPermissions } from "@/server/authz/authorize";

export const GET = partialRoute(async ({ session, state }) => {
  const base = { state, user: { id: session.user.id, name: session.user.name, email: session.user.email } };
  if (state !== "OK") return json(base);
  const actor = await buildActor(session.user, session.id);
  return json({
    ...base,
    permissions: [...allPermissions(actor)].sort(),
    scopes: actor.scopes.map((s) => ({ role: s.roleName, unit: s.unitName, includeDescendants: s.includeDescendants })),
  });
});
