import { z } from "zod";
import { authedRoute, json, readJson, readQuery } from "@/server/http/handler";
import { equipmentSchema } from "@/server/validation/phase3";
import { createEquipment, listEquipment } from "@/server/services/equipment.service";

const q = z.object({ q: z.string().max(100).optional(), status: z.enum(["DISPONIVEL", "EM_USO", "EM_MANUTENCAO", "INTERDITADO", "BAIXADO"]).optional() });
export const GET = authedRoute(async ({ req, actor }) => json({ equipment: await listEquipment(actor, readQuery(req, q)) }));
export const POST = authedRoute(async ({ req, actor, meta }) => json({ equipment: await createEquipment(actor, await readJson(req, equipmentSchema), meta) }, 201));
