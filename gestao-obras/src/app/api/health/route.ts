import { prisma } from "@/server/db";
import { json, publicRoute } from "@/server/http/handler";

export const dynamic = "force-dynamic";

export const GET = publicRoute(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return json({ status: "ok" });
  } catch {
    return json({ status: "erro", database: "indisponível" }, 503);
  }
});
