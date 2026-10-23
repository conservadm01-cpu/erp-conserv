"use client";
import { Film, ImageOff, Music } from "lucide-react";
import { useMediaUrl } from "@/lib/media/use-media-url";
import type { MediaAsset } from "@/lib/types";
import { cn } from "@/lib/cn";

/** Miniatura de uma mídia privada (URL temporária). */
export function MediaThumb({ asset, className, alt }: { asset: MediaAsset; className?: string; alt?: string }) {
  const path = asset.kind === "image" ? asset.thumb_path ?? asset.storage_path : asset.kind === "video" ? asset.storage_path : null;
  const url = useMediaUrl(path);
  const label = alt ?? (asset.caption || asset.original_name);
  if (asset.kind === "audio")
    return (
      <div className={cn("grid place-items-center bg-surface-2 text-muted", className)} role="img" aria-label={label}>
        <Music className="h-8 w-8" />
      </div>
    );
  if (!url)
    return (
      <div className={cn("grid place-items-center bg-surface-2 text-muted", className)} role="img" aria-label={label}>
        {asset.kind === "video" ? <Film className="h-8 w-8" /> : <ImageOff className="h-6 w-6" />}
      </div>
    );
  if (asset.kind === "video")
    return (
      <div className={cn("relative bg-black", className)}>
        <video src={`${url}#t=0.5`} muted preload="metadata" playsInline className="h-full w-full object-cover" aria-label={label} />
        <Film className="absolute bottom-1.5 left-1.5 h-4 w-4 text-white drop-shadow" aria-hidden />
      </div>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={label} loading="lazy" className={cn("bg-surface-2 object-cover", className)} />;
}

/** Mídia em tamanho real (imagem ou vídeo com controles). */
export function MediaPreview({ asset, path, className }: { asset: MediaAsset; path?: string; className?: string }) {
  const url = useMediaUrl(path ?? asset.storage_path);
  if (!url) return <div className={cn("grid aspect-video place-items-center rounded-xl bg-surface-2 text-sm text-muted", className)}>Carregando…</div>;
  if (asset.kind === "video") return <video src={url} controls playsInline className={cn("max-h-[60dvh] w-full rounded-xl bg-black", className)} />;
  if (asset.kind === "audio") return <audio src={url} controls className="w-full" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={asset.caption || asset.original_name} className={cn("max-h-[60dvh] w-full rounded-xl object-contain", className)} />;
}
