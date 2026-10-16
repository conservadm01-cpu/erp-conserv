import { z } from "zod";
import { authedRoute, json, readJson, readQuery } from "@/server/http/handler";
import { personSchema } from "@/server/validation/phase3";
import { createPerson, listPeople } from "@/server/services/people.service";

const q = z.object({ category: z.enum(["PROFISSIONAL", "EMPREGADO", "VOLUNTARIO", "OUTRO"]).optional(), q: z.string().max(100).optional(), status: z.enum(["ATIVO", "INATIVO"]).optional() });

export const GET = authedRoute(async ({ req, actor }) => json({ people: await listPeople(actor, readQuery(req, q)) }));
export const POST = authedRoute(async ({ req, actor, meta }) => json({ person: await createPerson(actor, await readJson(req, personSchema), meta) }, 201));
