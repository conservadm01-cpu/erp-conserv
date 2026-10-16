import { z } from "zod";
import { authedRoute, json, readJson } from "@/server/http/handler";
import { settingSchema } from "@/server/validation/phase4";
import { updateSetting } from "@/server/services/settings.service";

export const PUT = authedRoute<{ key: string }>(async ({ req, actor, params, meta }) => {
  const { value } = await readJson(req, settingSchema);
  return json({ setting: await updateSetting(actor, z.string().max(80).parse(params.key), value, meta) });
});
