import { z } from "zod";
import { authedRoute, json, readJson, readQuery } from "@/server/http/handler";
import { createOrgUnitSchema } from "@/server/validation/org-unit";
import { createOrgUnit, listOrgUnits } from "@/server/services/org-unit.service";

const query = z.object({ status: z.enum(["ATIVA", "INATIVA"]).optional(), q: z.string().trim().max(100).optional() });

export const GET = authedRoute(async ({ req, actor }) => json({ units: await listOrgUnits(actor, readQuery(req, query)) }));

export const POST = authedRoute(async ({ req, actor, meta }) => {
  const input = await readJson(req, createOrgUnitSchema);
  return json({ unit: await createOrgUnit(actor, input, meta) }, 201);
});
