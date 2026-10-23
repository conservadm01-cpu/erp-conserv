"use client";
import { getFiles, getRepo, newId } from "@/lib/data";
import type { ID, MediaAsset, NewRow, TripDocument } from "@/lib/types";
import { readHeader, safeDisplayName, validateUpload, type DetectedKind } from "./validate";

export interface UploadResult<T> {
  ok: T[];
  errors: { name: string; error: string }[];
}

interface ImageInfo {
  width: number | null;
  height: number | null;
  thumb: Blob | null;
}

/** Lê dimensões e gera miniatura (máx. 480px) sem travar a interface: usa createImageBitmap e OffscreenCanvas quando disponíveis. */
export async function imageInfo(file: Blob, max = 480): Promise<ImageInfo> {
  if (typeof createImageBitmap !== "function") return { width: null, height: null, thumb: null };
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    let thumb: Blob | null = null;
    if (typeof OffscreenCanvas !== "undefined") {
      const c = new OffscreenCanvas(w, h);
      c.getContext("2d")?.drawImage(bmp, 0, 0, w, h);
      thumb = await c.convertToBlob({ type: "image/jpeg", quality: 0.8 });
    } else if (typeof document !== "undefined") {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      c.getContext("2d")?.drawImage(bmp, 0, 0, w, h);
      thumb = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.8));
    }
    const out = { width: bmp.width, height: bmp.height, thumb };
    bmp.close();
    return out;
  } catch {
    return { width: null, height: null, thumb: null }; // ex.: HEIC em navegadores sem suporte
  }
}

async function videoInfo(file: Blob): Promise<{ width: number | null; height: number | null; duration: number | null }> {
  if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") return { width: null, height: null, duration: null };
  return new Promise((resolve) => {
    const v = document.createElement("video");
    const url = URL.createObjectURL(file);
    const done = (r: { width: number | null; height: number | null; duration: number | null }) => {
      URL.revokeObjectURL(url);
      resolve(r);
    };
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => done({ width: v.videoWidth || null, height: v.videoHeight || null, duration: Number.isFinite(v.duration) ? v.duration : null });
    v.onerror = () => done({ width: null, height: null, duration: null });
    setTimeout(() => done({ width: null, height: null, duration: null }), 8000);
    v.src = url;
  });
}

async function exifInfo(file: Blob): Promise<{ taken_at: string | null; lat: number | null; lng: number | null }> {
  try {
    const exifr = (await import("exifr")).default;
    const data = (await exifr.parse(file, { gps: true, pick: ["DateTimeOriginal", "CreateDate", "latitude", "longitude"] })) as
      | { DateTimeOriginal?: Date; CreateDate?: Date; latitude?: number; longitude?: number }
      | undefined;
    const d = data?.DateTimeOriginal ?? data?.CreateDate;
    return {
      taken_at: d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null,
      lat: typeof data?.latitude === "number" ? data.latitude : null,
      lng: typeof data?.longitude === "number" ? data.longitude : null,
    };
  } catch {
    return { taken_at: null, lat: null, lng: null };
  }
}

export interface UploadOptions {
  /** Mantém a localização GPS da foto (exige consentimento do usuário). */
  keepLocation?: boolean;
  allowed?: DetectedKind[];
  extra?: Partial<NewRow<"media_assets">>;
  onProgress?: (done: number, total: number) => void;
}

/** Envia vários arquivos de mídia: valida, guarda original + miniatura e cria os registros. Sem limite artificial de quantidade. */
export async function uploadMediaFiles(tripId: ID, files: File[], opts: UploadOptions = {}): Promise<UploadResult<MediaAsset>> {
  const repo = getRepo();
  const store = getFiles();
  const out: UploadResult<MediaAsset> = { ok: [], errors: [] };
  let done = 0;
  for (const file of files) {
    try {
      const header = await readHeader(file);
      const v = validateUpload(file.name, file.size, header, opts.allowed ?? ["image", "video", "audio"]);
      if (!v.ok || !v.detected) throw new Error(v.error);
      const det = v.detected;
      const id = newId();
      const path = `${tripId}/${id}.${det.ext}`;
      let width: number | null = null;
      let height: number | null = null;
      let duration: number | null = null;
      let thumbPath: string | null = null;
      let exif = { taken_at: null as string | null, lat: null as number | null, lng: null as number | null };
      if (det.kind === "image") {
        const info = await imageInfo(file);
        width = info.width;
        height = info.height;
        exif = await exifInfo(file);
        if (info.thumb) thumbPath = await store.put("media", `${tripId}/${id}.thumb.jpg`, info.thumb, tripId);
      } else if (det.kind === "video") {
        const info = await videoInfo(file);
        width = info.width;
        height = info.height;
        duration = info.duration;
      }
      await store.put("media", path, new Blob([file], { type: det.mime }), tripId);
      const row = await repo.insert("media_assets", {
        id,
        trip_id: tripId,
        kind: det.kind === "document" ? "image" : det.kind,
        storage_path: path,
        thumb_path: thumbPath,
        original_name: safeDisplayName(file.name),
        mime_type: det.mime,
        size_bytes: file.size,
        width,
        height,
        duration_sec: duration,
        taken_at: exif.taken_at ?? (file.lastModified ? new Date(file.lastModified).toISOString() : null),
        lat: opts.keepLocation ? exif.lat : null,
        lng: opts.keepLocation ? exif.lng : null,
        caption: "",
        tags: [],
        people: [],
        album: "",
        favorite: false,
        instagrammable: false,
        diary_entry_id: null,
        story_answers: [],
        ...opts.extra,
      });
      out.ok.push(row);
    } catch (e) {
      out.errors.push({ name: file.name, error: e instanceof Error ? e.message : String(e) });
    }
    opts.onProgress?.(++done, files.length);
  }
  return out;
}

/** Exclui a mídia, suas versões editadas e os arquivos correspondentes. */
export async function deleteMedia(asset: MediaAsset): Promise<void> {
  const repo = getRepo();
  const edits = await repo.list("photo_edits", { trip_id: asset.trip_id, media_id: asset.id });
  await getFiles().remove("media", [asset.storage_path, asset.thumb_path ?? "", ...edits.map((e) => e.output_path)].filter(Boolean));
  for (const e of edits) await repo.remove("photo_edits", e.id);
  await repo.remove("media_assets", asset.id);
}

/** Envia um documento (PDF/imagem) privado: voucher, comprovante, bilhete, seguro. */
export async function uploadDocument(
  tripId: ID,
  file: File,
  meta: Pick<TripDocument, "kind" | "title"> & Partial<Pick<TripDocument, "reservation_id" | "expense_id">>,
): Promise<TripDocument> {
  const header = await readHeader(file);
  const v = validateUpload(file.name, file.size, header, ["document", "image"]);
  if (!v.ok || !v.detected) throw new Error(v.error);
  const path = `${tripId}/${newId()}.${v.detected.ext}`;
  await getFiles().put("documents", path, new Blob([file], { type: v.detected.mime }), tripId);
  return getRepo().insert("documents", {
    trip_id: tripId,
    reservation_id: meta.reservation_id ?? null,
    expense_id: meta.expense_id ?? null,
    kind: meta.kind,
    title: meta.title || safeDisplayName(file.name),
    storage_path: path,
    mime_type: v.detected.mime,
    size_bytes: file.size,
  });
}

export async function deleteDocument(doc: TripDocument): Promise<void> {
  await getFiles().remove("documents", [doc.storage_path]);
  await getRepo().remove("documents", doc.id);
}
