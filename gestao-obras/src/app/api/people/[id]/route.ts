import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { updatePersonSchema } from "@/server/validation/phase3";
import { getPerson, updatePerson } from "@/server/services/people.service";

type P = { id: string };
export const GET = authedRoute<P>(async ({ actor, params }) => json({ person: await getPerson(actor, uuid.parse(params.id)) }));
export const PATCH = authedRoute<P>(async ({ req, actor, params, meta }) => json({ person: await updatePerson(actor, uuid.parse(params.id), await readJson(req, updatePersonSchema), meta) }));
