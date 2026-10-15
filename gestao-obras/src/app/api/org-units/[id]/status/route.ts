import { authedRoute, json, readJson } from "@/server/http/handler";
import { orgUnitStatusSchema } from "@/server/validation/org-unit";
import { uuid } from "@/server/validation/common";
import { setOrgUnitStatus } from "@/server/services/org-unit.service";

export const POST = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) => {
  const { status, reason } = await readJson(req, orgUnitStatusSchema);
  return json({ unit: await setOrgUnitStatus(actor, uuid.parse(params.id), status, reason, meta) });
});
