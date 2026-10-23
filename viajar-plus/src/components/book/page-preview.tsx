"use client";
import type { AlbumFormat, AlbumPage, MediaAsset } from "@/lib/types";
import { PAGE_SIZES } from "@/lib/album/pdf";
import { MediaThumb } from "@/components/media/media-thumb";
import { FileText } from "lucide-react";

/** Miniatura esquemática de uma página do book. */
export function PagePreview({ page, format, media }: { page: AlbumPage; format: AlbumFormat; media: Map<string, MediaAsset> }) {
  const [w, h] = PAGE_SIZES[format];
  const n = page.layout === "texto" ? 1 : page.layout === "colagem" ? 6 : Number(page.layout);
  const items = page.items.slice(0, n);
  const cols = items.length <= 1 ? 1 : items.length <= 4 ? 2 : 3;
  return (
    <div className="w-20 shrink-0 overflow-hidden rounded border border-line shadow-sm sm:w-24" style={{ aspectRatio: `${w} / ${h}`, background: page.background || "#fff" }} aria-hidden>
      <div className="flex h-full flex-col gap-0.5 p-1">
        {page.title && <div className="h-1.5 w-2/3 rounded bg-slate-400/70" />}
        {items.length ? (
          <div className="grid flex-1 gap-0.5" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {items.map((it, i) => {
              const m = media.get(it.media_id);
              return m ? <MediaThumb key={i} asset={m} className="h-full w-full" /> : <div key={i} className="bg-slate-300" />;
            })}
          </div>
        ) : (
          <div className="grid flex-1 place-items-center text-slate-400">
            <FileText className="h-5 w-5" />
          </div>
        )}
        {page.text && page.layout !== "texto" && <div className="h-1 w-full rounded bg-slate-300" />}
      </div>
    </div>
  );
}
