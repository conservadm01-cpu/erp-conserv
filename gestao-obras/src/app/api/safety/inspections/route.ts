import { z } from "zod";
import { authedRoute, json, readJson, readQuery } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { inspectionSchema } from "@/server/validation/phase3";
import { createInspection, listInspections } from "@/server/services/safety.service";

const q = z.object({ workId: uuid.optional(), status: z.enum(["PLANEJADA", "EM_ANDAMENTO", "CONCLUIDA", "CANCELADA"]).optional() });
export const GET = authedRoute(async ({ req, actor }) => json({ inspections: await listInspections(actor, readQuery(req, q)) }));
export const POST = authedRoute(async ({ req, actor, meta }) => json({ inspection: await createInspection(actor, await readJson(req, inspectionSchema), meta) }, 201));
