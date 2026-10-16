import { z } from "zod";
import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { reviewHealthCertificate } from "@/server/services/health.service";

export const PATCH = authedRoute<{ id: string; certificateId: string }>(async ({ req, actor, params, meta }) => {
  const { decision } = await readJson(req, z.object({ decision: z.enum(["CONFERIR", "INATIVAR"]) }));
  return json({ certificate: await reviewHealthCertificate(actor, uuid.parse(params.id), uuid.parse(params.certificateId), decision, meta) });
});
