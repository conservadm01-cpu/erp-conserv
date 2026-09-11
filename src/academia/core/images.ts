// =====================================================================
// FILE STORAGE (protótipo)
// ---------------------------------------------------------------------
// Imagens enviadas (foto de risco, foto do colaborador) são reduzidas e
// guardadas como data URL no próprio registro. Serve para o protótipo e
// para uso interno leve.
//
// PONTO DE TROCA: com backend, troque `fileToDataUrl` por upload ao
// storage (Supabase Storage / S3) e guarde apenas a URL no registro.
// =====================================================================

export const MAX_IMAGE_BYTES = 900 * 1024;

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

/** Reduz a imagem para caber no banco sem perder utilidade visual. */
export async function compressImage(file: File, maxSide = 1100, quality = 0.72): Promise<string> {
  const dataUrl = await fileToDataUrl(file);
  if (!file.type.startsWith("image/")) return dataUrl;
  try {
    const image = await loadImage(dataUrl);
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return dataUrl;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Imagem inválida"));
    image.src = src;
  });
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
