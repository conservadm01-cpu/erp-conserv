import { z } from "zod";
import { authedRoute, json, readJson, readQuery } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { deliverySchema } from "@/server/validation/phase3";
import { deliver, listDeliveries } from "@/server/services/epi.service";

const q = z.object({ personId: uuid.optional(), workId: uuid.optional() });
export const GET = authedRoute(async ({ req, actor }) => json({ deliveries: await listDeliveries(actor, readQuery(req, q)) }));
export const POST = authedRoute(async ({ req, actor, meta }) => json(await deliver(actor, await readJson(req, deliverySchema), meta), 201));
