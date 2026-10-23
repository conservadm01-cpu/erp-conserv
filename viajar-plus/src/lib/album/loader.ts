"use client";
import { getFiles } from "@/lib/data";
import type { MediaAsset, PhotoEdit } from "@/lib/types";
import { canvasToBlob, loadSource, makeCanvas } from "@/lib/photo/render";
import { coverSource } from "@/lib/photo/collage";
import type { ImageLoader, LoadedImage } from "./pdf";

const DPI = 300;

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });
}

/** Carregador de imagens do navegador: usa a versão editada quando escolhida e reduz para ~300 dpi do tamanho impresso. */
export function browserImageLoader(media: Map<string, MediaAsset>, edits: Map<string, PhotoEdit>): ImageLoader {
  return async (item, boxMm, fit): Promise<LoadedImage | null> => {
    const asset = media.get(item.media_id);
    if (!asset || asset.kind !== "image") return null;
    const path = (item.edit_id && edits.get(item.edit_id)?.output_path) || asset.storage_path;
    const blob = await getFiles().get("media", path);
    if (!blob) return null;
    const src = await loadSource(blob);
    const sw = "naturalWidth" in src ? src.naturalWidth : src.width;
    const sh = "naturalHeight" in src ? src.naturalHeight : src.height;
    const maxW = Math.ceil((boxMm.w / 25.4) * DPI);
    const maxH = Math.ceil((boxMm.h / 25.4) * DPI);
    const s = fit === "cover" ? coverSource(sw, sh, boxMm.w, boxMm.h) : { x: 0, y: 0, w: sw, h: sh };
    const scale = Math.min(1, maxW / s.w, maxH / s.h);
    const w = Math.max(1, Math.round(s.w * scale));
    const h = Math.max(1, Math.round(s.h * scale));
    const c = makeCanvas(w, h);
    const ctx = c.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src as CanvasImageSource, s.x, s.y, s.w, s.h, 0, 0, w, h);
    if ("close" in src && typeof src.close === "function") src.close();
    const out = await canvasToBlob(c, "image/jpeg", 0.9);
    return { data: await blobToDataUrl(out), width: w, height: h, format: "JPEG" };
  };
}
