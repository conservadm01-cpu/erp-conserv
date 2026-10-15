import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { assignmentSchema } from "@/server/validation/phase3";
import { addAssignment } from "@/server/services/people.service";

export const POST = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) => json(await addAssignment(actor, uuid.parse(params.id), await readJson(req, assignmentSchema), meta), 201));
