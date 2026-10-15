/** Tipos aceitos, identificados pelo conteúdo (assinatura), não pela extensão. */
export const ALLOWED_TYPES = [
  { mime: "application/pdf", ext: "pdf", label: "PDF" },
  { mime: "image/png", ext: "png", label: "PNG" },
  { mime: "image/jpeg", ext: "jpg", label: "JPEG" },
  { mime: "image/webp", ext: "webp", label: "WEBP" },
] as const;

export type AllowedMime = (typeof ALLOWED_TYPES)[number]["mime"];

export function sniffFileType(bytes: Uint8Array): AllowedMime | null {
  const b = (i: number) => bytes[i];
  if (bytes.length >= 5 && b(0) === 0x25 && b(1) === 0x50 && b(2) === 0x44 && b(3) === 0x46 && b(4) === 0x2d) return "application/pdf";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b(i) === v)) return "image/png";
  if (bytes.length >= 3 && b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

/** Nome seguro para exibição e para o cabeçalho de download. */
export function sanitizeFileName(name: string, mime: AllowedMime): string {
  const ext = ALLOWED_TYPES.find((t) => t.mime === mime)!.ext;
  const base = name
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_")
    .replace(/\.[^.]*$/, "")
    .trim()
    .slice(0, 150);
  return `${base || "arquivo"}.${ext}`;
}
