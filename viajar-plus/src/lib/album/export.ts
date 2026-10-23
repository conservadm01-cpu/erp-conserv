"use client";
import { getRepo } from "@/lib/data";
import { computeTotals, totalsByCategory } from "@/lib/budget/calc";
import { categoryName } from "@/lib/budget/categories";
import type { Album, AlbumPage, AlbumPageItem, Trip } from "@/lib/types";
import { buildAlbumPdf, type BudgetSummary } from "./pdf";
import { browserImageLoader } from "./loader";

/** Reúne os dados da viagem e gera o PDF do book no navegador. */
export async function exportAlbumPdf(trip: Trip, album: Album, pages: AlbumPage[], onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const repo = getRepo();
  const [media, edits, days, items, diary, expenses, payments, cats, budgets] = await Promise.all([
    repo.list("media_assets", { trip_id: trip.id }),
    repo.list("photo_edits", { trip_id: trip.id }),
    repo.list("itinerary_days", { trip_id: trip.id }),
    repo.list("itinerary_items", { trip_id: trip.id }),
    repo.list("diary_entries", { trip_id: trip.id }),
    repo.list("expenses", { trip_id: trip.id }),
    repo.list("payments", { trip_id: trip.id }),
    repo.list("budget_categories", { trip_id: trip.id }),
    repo.list("budgets", { trip_id: trip.id }),
  ]);
  const mediaMap = new Map(media.map((m) => [m.id, m]));
  let budget: BudgetSummary | null = null;
  if (album.include_budget) {
    const total = budgets[0]?.total ?? trip.budget_total;
    budget = {
      currency: trip.currency,
      totals: computeTotals(expenses, payments, total),
      categories: totalsByCategory(expenses, payments).map((c) => ({ name: categoryName(c.category, cats), planned: c.planned, realized: c.realized, projected: c.projected })),
    };
  }
  const included = pages.filter((p) => p.included);
  const coverId = trip.cover_media_id && mediaMap.get(trip.cover_media_id)?.kind === "image" ? trip.cover_media_id : (included.flatMap((p) => p.items)[0]?.media_id ?? media.find((m) => m.kind === "image" && m.favorite)?.id ?? null);
  const coverItem: AlbumPageItem | null = coverId ? { media_id: coverId, edit_id: null, caption: "", frame: "", fit: "cover" } : null;
  const doc = await buildAlbumPdf(
    { album, pages, trip, coverItem, itinerary: { days, items }, diary, budget, media: mediaMap, onProgress },
    browserImageLoader(mediaMap, new Map(edits.map((e) => [e.id, e]))),
  );
  return doc.output("blob");
}
