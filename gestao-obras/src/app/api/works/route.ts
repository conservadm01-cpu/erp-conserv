import { authedRoute, json, readJson, readQuery } from "@/server/http/handler";
import { createWorkSchema, workListQuery } from "@/server/validation/work";
import { createWork, listWorks } from "@/server/services/work.service";

export const GET = authedRoute(async ({ req, actor }) => json({ works: await listWorks(actor, readQuery(req, workListQuery)) }));

export const POST = authedRoute(async ({ req, actor, meta }) => json({ work: await createWork(actor, await readJson(req, createWorkSchema), meta) }, 201));
