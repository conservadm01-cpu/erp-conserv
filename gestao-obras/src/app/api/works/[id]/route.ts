import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { updateWorkSchema, type UpdateWorkInput } from "@/server/validation/work";
import { getWork, updateWork } from "@/server/services/work.service";

type P = { id: string };

export const GET = authedRoute<P>(async ({ actor, params }) => json({ work: await getWork(actor, uuid.parse(params.id)) }));

export const PATCH = authedRoute<P>(async ({ req, actor, params, meta }) => {
  const input = (await readJson(req, updateWorkSchema)) as UpdateWorkInput;
  return json({ work: await updateWork(actor, uuid.parse(params.id), input, meta) });
});
