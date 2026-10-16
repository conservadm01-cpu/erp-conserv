import { z } from "zod";
import { authedRoute, json, readJson, readQuery } from "@/server/http/handler";
import { companySchema } from "@/server/validation/phase3";
import { createCompany, listCompanies } from "@/server/services/company.service";

const q = z.object({ q: z.string().max(100).optional(), status: z.enum(["ATIVO", "INATIVO"]).optional() });
export const GET = authedRoute(async ({ req, actor }) => json({ companies: await listCompanies(actor, readQuery(req, q)) }));
export const POST = authedRoute(async ({ req, actor, meta }) => json({ company: await createCompany(actor, await readJson(req, companySchema), meta) }, 201));
