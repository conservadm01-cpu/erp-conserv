import { json, publicRoute } from "@/server/http/handler";
import { openApiDocument } from "@/server/openapi";

export const GET = publicRoute(async () => json(openApiDocument));
