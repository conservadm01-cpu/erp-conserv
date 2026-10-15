import { authedRoute, json, readJson } from "@/server/http/handler";
import { epiCatalogSchema } from "@/server/validation/phase3";
import { createCatalogItem, listCatalog } from "@/server/services/epi.service";

export const GET = authedRoute(async ({ actor }) => json({ catalog: await listCatalog(actor, { includeInactive: true }) }));
export const POST = authedRoute(async ({ req, actor, meta }) => json({ item: await createCatalogItem(actor, await readJson(req, epiCatalogSchema), meta) }, 201));
