// Validação de arquivos enviados: o tipo é decidido pela assinatura binária
// (magic bytes), não pela extensão nem pelo MIME declarado pelo navegador.
// Formatos que podem carregar script (SVG, HTML) são sempre recusados.

export type DetectedKind = "image" | "video" | "audio" | "document";

export interface Detected {
  mime: string;
  kind: DetectedKind;
  ext: string;
}

const MB = 1024 * 1024;

export const UPLOAD_LIMITS = {
  image: Number(process.env.NEXT_PUBLIC_MAX_IMAGE_MB ?? 40) * MB,
  video: Number(process.env.NEXT_PUBLIC_MAX_VIDEO_MB ?? 1024) * MB,
  audio: Number(process.env.NEXT_PUBLIC_MAX_AUDIO_MB ?? 100) * MB,
  document: Number(process.env.NEXT_PUBLIC_MAX_DOCUMENT_MB ?? 20) * MB,
};

function ascii(b: Uint8Array, start: number, len: number): string {
  return String.fromCharCode(...b.subarray(start, start + len));
}

/** Identifica o formato real a partir dos primeiros bytes (mínimo 16). */
export function sniff(b: Uint8Array): Detected | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", kind: "image", ext: "jpg" };
  if (b[0] === 0x89 && ascii(b, 1, 3) === "PNG") return { mime: "image/png", kind: "image", ext: "png" };
  if (ascii(b, 0, 4) === "GIF8") return { mime: "image/gif", kind: "image", ext: "gif" };
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return { mime: "image/webp", kind: "image", ext: "webp" };
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WAVE") return { mime: "audio/wav", kind: "audio", ext: "wav" };
  if (ascii(b, 0, 5) === "%PDF-") return { mime: "application/pdf", kind: "document", ext: "pdf" };
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { mime: "video/webm", kind: "video", ext: "webm" };
  if (ascii(b, 0, 4) === "OggS") return { mime: "audio/ogg", kind: "audio", ext: "ogg" };
  if (ascii(b, 0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return { mime: "audio/mpeg", kind: "audio", ext: "mp3" };
  if (ascii(b, 4, 4) === "ftyp") {
    const brand = ascii(b, 8, 4);
    if (["heic", "heix", "hevc", "heim", "heis", "mif1", "msf1"].includes(brand)) return { mime: "image/heic", kind: "image", ext: "heic" };
    if (brand === "avif" || brand === "avis") return { mime: "image/avif", kind: "image", ext: "avif" };
    if (brand === "qt  ") return { mime: "video/quicktime", kind: "video", ext: "mov" };
    if (brand.startsWith("M4A")) return { mime: "audio/mp4", kind: "audio", ext: "m4a" };
    return { mime: "video/mp4", kind: "video", ext: "mp4" };
  }
  return null;
}

const DANGEROUS_EXT = /\.(svg|svgz|html?|xhtml|js|mjs|exe|bat|cmd|sh|php|jar|msi|scr|vbs|ps1)$/i;

export interface ValidationResult {
  ok: boolean;
  error?: string;
  detected?: Detected;
}

/** Valida nome, tamanho e conteúdo real. `allowed` restringe as categorias aceitas. */
export function validateUpload(name: string, size: number, header: Uint8Array, allowed: DetectedKind[]): ValidationResult {
  if (!name || name.length > 255) return { ok: false, error: "Nome de arquivo inválido." };
  if (DANGEROUS_EXT.test(name)) return { ok: false, error: "Tipo de arquivo não permitido por segurança." };
  if (size <= 0) return { ok: false, error: "Arquivo vazio." };
  const detected = sniff(header);
  if (!detected) return { ok: false, error: "Formato não reconhecido. Envie JPG, PNG, WebP, HEIC, GIF, MP4, MOV, WebM, MP3, WAV ou PDF." };
  if (!allowed.includes(detected.kind)) return { ok: false, error: `Este espaço não aceita arquivos do tipo ${detected.kind}.` };
  const limit = UPLOAD_LIMITS[detected.kind];
  if (size > limit) return { ok: false, error: `Arquivo maior que o limite de ${Math.round(limit / MB)} MB para ${detected.kind}.` };
  return { ok: true, detected };
}

export async function readHeader(file: Blob, n = 32): Promise<Uint8Array> {
  const slice = file.slice(0, n);
  const buf = typeof slice.arrayBuffer === "function" ? await slice.arrayBuffer() : await new Response(slice).arrayBuffer();
  return new Uint8Array(buf);
}

/** Remove caminhos e caracteres perigosos do nome exibido. */
export function safeDisplayName(name: string): string {
  return name.replace(/[\\/]/g, "_").replace(/[\u0000-\u001f<>"'`]/g, "").slice(0, 200) || "arquivo";
}
