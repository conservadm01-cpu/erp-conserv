import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { equipmentLogSchema } from "@/server/validation/phase3";
import { addEquipmentLog } from "@/server/services/equipment.service";

export const POST = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) => json({ log: await addEquipmentLog(actor, uuid.parse(params.id), await readJson(req, equipmentLogSchema), meta) }, 201));
