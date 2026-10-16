import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { updateAssignmentSchema } from "@/server/validation/phase3";
import { updateAssignment } from "@/server/services/people.service";

export const PATCH = authedRoute<{ id: string; assignmentId: string }>(async ({ req, actor, params, meta }) =>
  json({ assignment: await updateAssignment(actor, uuid.parse(params.id), uuid.parse(params.assignmentId), await readJson(req, updateAssignmentSchema), meta) }),
);
