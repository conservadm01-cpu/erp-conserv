import { z } from "zod";
import { authedRoute, json, readJson, readQuery } from "@/server/http/handler";
import { uuid } from "@/server/validation/common";
import { listMyNotifications, markRead, unreadCount } from "@/server/services/notification.service";

export const GET = authedRoute(async ({ req, actor }) => {
  const { unread } = readQuery(req, z.object({ unread: z.enum(["1"]).optional() }));
  return json({ notifications: await listMyNotifications(actor, { unreadOnly: Boolean(unread) }), unread: await unreadCount(actor.userId) });
});

export const PATCH = authedRoute(async ({ req, actor }) => {
  const { ids } = await readJson(req, z.object({ ids: z.union([z.literal("all"), z.array(uuid).max(500)]) }));
  return json({ updated: await markRead(actor, ids) });
});
