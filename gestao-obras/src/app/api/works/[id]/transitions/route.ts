import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { transitionSchema } from "@/server/validation/work";
import { transitionWork } from "@/server/services/work.service";

export const POST = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) =>
  json({ work: await transitionWork(actor, uuid.parse(params.id), await readJson(req, transitionSchema), meta) }),
);
