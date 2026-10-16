import { z } from "zod";
import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { receiptSchema, returnSchema } from "@/server/validation/phase3";
import { confirmReceipt, returnDelivery } from "@/server/services/epi.service";

const body = z.union([z.object({ action: z.literal("confirmar") }).merge(receiptSchema), z.object({ action: z.literal("devolver") }).merge(returnSchema)]);

export const PATCH = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) => {
  const { action, ...input } = await readJson(req, body);
  const id = uuid.parse(params.id);
  return json({ delivery: action === "confirmar" ? await confirmReceipt(actor, id, input as z.infer<typeof receiptSchema>, meta) : await returnDelivery(actor, id, input as z.infer<typeof returnSchema>, meta) });
});
