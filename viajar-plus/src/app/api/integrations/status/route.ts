import { integrationStatus } from "@/lib/providers/registry";
import { clientKey, rateLimit, tooMany } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const rl = rateLimit(`status:${clientKey(req)}`, 30, 60_000);
  if (!rl.ok) return tooMany(rl);
  return Response.json({ integrations: integrationStatus(), checked_at: new Date().toISOString() });
}
