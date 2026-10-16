import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { contractSchema } from "@/server/validation/phase3";
import { createContract } from "@/server/services/company.service";

export const POST = authedRoute<{ id: string }>(async ({ req, actor, params, meta }) => json({ contract: await createContract(actor, uuid.parse(params.id), await readJson(req, contractSchema), meta) }, 201));
