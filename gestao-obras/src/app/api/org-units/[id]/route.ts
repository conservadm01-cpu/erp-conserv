import { authedRoute, json, readJson } from "@/server/http/handler";
import { updateOrgUnitSchema } from "@/server/validation/org-unit";
import { uuid } from "@/server/validation/common";
import { getOrgUnit, updateOrgUnit } from "@/server/services/org-unit.service";

type P = { id: string };

export const GET = authedRoute<P>(async ({ actor, params }) => json({ unit: await getOrgUnit(actor, uuid.parse(params.id)) }));

export const PATCH = authedRoute<P>(async ({ req, actor, params, meta }) => {
  const input = await readJson(req, updateOrgUnitSchema);
  return json({ unit: await updateOrgUnit(actor, uuid.parse(params.id), input, meta) });
});
