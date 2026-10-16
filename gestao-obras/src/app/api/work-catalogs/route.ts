import { authedRoute, json } from "@/server/http/handler";
import { listWorkCatalogs } from "@/server/services/work.service";
import { listCategories } from "@/server/services/document.service";

export const GET = authedRoute(async () => {
  const [catalogs, categories] = await Promise.all([listWorkCatalogs(), listCategories()]);
  return json({ ...catalogs, documentCategories: categories });
});
