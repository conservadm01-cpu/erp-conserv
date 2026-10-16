import { z } from "zod";
import { authedRoute, json, readQuery } from "@/server/http/handler";
import { searchSubjects } from "@/server/services/privacy.service";

export const GET = authedRoute(async ({ req, actor }) => {
  const { q } = readQuery(req, z.object({ q: z.string().trim().max(100).default("") }));
  return json({ subjects: await searchSubjects(actor, q) });
});
