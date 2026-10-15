import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { equipmentStatusSchema } from "@/server/validation/phase3";
import { getEquipment, setEquipmentStatus } from "@/server/services/equipment.service";

type P = { id: string };
export const GET = authedRoute<P>(async ({ actor, params }) => json({ equipment: await getEquipment(actor, uuid.parse(params.id)) }));
export const PATCH = authedRoute<P>(async ({ req, actor, params, meta }) => {
  const { status, reason } = await readJson(req, equipmentStatusSchema);
  return json({ equipment: await setEquipmentStatus(actor, uuid.parse(params.id), status, reason, meta) });
});
