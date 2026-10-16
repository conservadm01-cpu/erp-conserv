import { z } from "zod";
import { authedRoute, json, readJson } from "@/server/http/handler";
import { criticalitySchema } from "@/server/validation/phase3";
import { updateCriticality } from "@/server/services/safety.service";

export const PUT = authedRoute<{ code: string }>(async ({ req, actor, params, meta }) =>
  json({ level: await updateCriticality(actor, z.string().max(20).parse(params.code), await readJson(req, criticalitySchema), meta) }),
);
