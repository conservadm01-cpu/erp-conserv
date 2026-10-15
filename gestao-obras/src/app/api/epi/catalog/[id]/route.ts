import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { epiCatalogSchema } from "@/server/validation/phase3";
import { updateCatalogItem } from "@/server/services/epi.service";

export const PUT = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) => json({ item: await updateCatalogItem(actor, uuid.parse(params.id), await readJson(req, epiCatalogSchema), meta) }));
