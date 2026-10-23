"use client";
import { getFiles, getRepo, newId } from "@/lib/data";
import { uploadMediaFiles } from "@/lib/media/upload";
import type { ID, MediaAsset, PhotoEdit } from "@/lib/types";
import { canvasToBlob, EXPORT_FORMATS, loadSource, makeCanvas, renderEdit } from "./render";
import { collageCells, coverSource } from "./collage";
import type { EditState } from "./state";

export async function loadOriginal(asset: MediaAsset): Promise<Blob> {
  const blob = await getFiles().get("media", asset.storage_path);
  if (!blob) throw new Error("Arquivo original não encontrado.");
  return blob;
}

export async function renderToBlob(asset: MediaAsset, st: EditState, mime = "image/jpeg", quality = 0.92): Promise<{ blob: Blob; width: number; height: number }> {
  const src = await loadSource(await loadOriginal(asset));
  const canvas = await renderEdit(src, st);
  const blob = await canvasToBlob(canvas, mime, quality);
  return { blob, width: canvas.width, height: canvas.height };
}

/** Salva uma versão editada em arquivo novo; o original nunca é sobrescrito. */
export async function saveEditVersion(asset: MediaAsset, st: EditState, name: string, mime = "image/jpeg", quality = 0.92, rendered?: { blob: Blob; width: number; height: number }): Promise<PhotoEdit> {
  const out = rendered ?? (await renderToBlob(asset, st, mime, quality));
  const ext = EXPORT_FORMATS.find((f) => f.mime === mime)?.ext ?? "jpg";
  const path = `${asset.trip_id}/${asset.id}.edit-${newId()}.${ext}`;
  await getFiles().put("media", path, out.blob, asset.trip_id);
  return getRepo().insert("photo_edits", {
    trip_id: asset.trip_id,
    media_id: asset.id,
    name: name.trim() || "Versão editada",
    operations: st as unknown as Record<string, unknown>,
    output_path: path,
    output_mime: mime,
    width: out.width,
    height: out.height,
  });
}

export async function deleteEditVersion(edit: PhotoEdit): Promise<void> {
  await getFiles().remove("media", [edit.output_path]);
  await getRepo().remove("photo_edits", edit.id);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Monta uma colagem (2–6 fotos) e salva como nova mídia da viagem. */
export async function createCollage(tripId: ID, assets: MediaAsset[], opts: { size?: number; ratio?: number; gap?: number; background?: string; caption?: string } = {}): Promise<MediaAsset> {
  const imgs = assets.filter((a) => a.kind === "image").slice(0, 6);
  if (imgs.length < 2) throw new Error("Selecione de 2 a 6 fotos para a colagem.");
  const W = opts.size ?? 2400;
  const H = Math.round(W / (opts.ratio ?? 1));
  const gap = opts.gap ?? Math.round(W * 0.015);
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  ctx.fillStyle = opts.background ?? "#ffffff";
  ctx.fillRect(0, 0, W, H);
  const cells = collageCells(imgs.length, W, H, gap);
  for (let i = 0; i < imgs.length; i++) {
    const src = await loadSource(await loadOriginal(imgs[i]));
    const sw = "naturalWidth" in src ? src.naturalWidth : src.width;
    const sh = "naturalHeight" in src ? src.naturalHeight : src.height;
    const c = cells[i];
    const s = coverSource(sw, sh, c.w, c.h);
    ctx.drawImage(src as CanvasImageSource, s.x, s.y, s.w, s.h, c.x, c.y, c.w, c.h);
  }
  const blob = await canvasToBlob(canvas, "image/jpeg", 0.9);
  const file = new File([blob], `colagem-${Date.now()}.jpg`, { type: "image/jpeg" });
  const res = await uploadMediaFiles(tripId, [file], { allowed: ["image"], extra: { caption: opts.caption ?? "Colagem", tags: ["colagem"] } });
  if (!res.ok[0]) throw new Error(res.errors[0]?.error ?? "Falha ao salvar a colagem");
  return res.ok[0];
}
