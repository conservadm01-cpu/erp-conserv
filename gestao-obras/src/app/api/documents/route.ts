import { authedRoute, json, readQuery } from "@/server/http/handler";
import { documentSearchQuery } from "@/server/validation/document";
import { searchDocuments } from "@/server/services/document.service";

export const GET = authedRoute(async ({ req, actor }) => json({ documents: await searchDocuments(actor, readQuery(req, documentSearchQuery)) }));
