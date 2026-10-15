import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { inspectionItemsSchema } from "@/server/validation/phase3";
import { getInspection, saveInspectionItems } from "@/server/services/safety.service";

type P = { id: string };
export const GET = authedRoute<P>(async ({ actor, params }) => json({ inspection: await getInspection(actor, uuid.parse(params.id)) }));
export const PUT = authedRoute<P>(async ({ req, actor, params, meta }) => {
  await saveInspectionItems(actor, uuid.parse(params.id), await readJson(req, inspectionItemsSchema), meta);
  return json({ ok: true });
});
