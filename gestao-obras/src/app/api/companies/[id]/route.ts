import { authedRoute, json, readJson } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { updateCompanySchema } from "@/server/validation/phase3";
import { getCompany, updateCompany } from "@/server/services/company.service";

type P = { id: string };
export const GET = authedRoute<P>(async ({ actor, params }) => json({ company: await getCompany(actor, uuid.parse(params.id)) }));
export const PATCH = authedRoute<P>(async ({ req, actor, params, meta }) => json({ company: await updateCompany(actor, uuid.parse(params.id), await readJson(req, updateCompanySchema), meta) }));
