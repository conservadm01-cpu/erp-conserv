// =====================================================================
// Extratores de conteúdo (seção 21)
// ---------------------------------------------------------------------
// Transformam o material enviado em texto com localizador (página,
// slide, parágrafo). O localizador é o que permite que um SOURCE_ID
// aponte para um lugar concreto do documento original.
//
// Tudo roda no navegador; nenhum arquivo sai do dispositivo nesta etapa.
// Quando houver backend, basta trocar estes extratores por chamadas ao
// serviço de ingestão — o restante do CONTENT_ENGINE não muda.
// =====================================================================

import type { ContentFileType } from "../../../core/types";
import { cleanExtractedText, splitParagraphs } from "../../../core/text";
import type { ExtractionResult } from "./types";

export type { ExtractionResult, ExtractedSection } from "./types";

export function detectFileType(file: File): ContentFileType {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx") || name.endsWith(".doc")) return "docx";
  if (name.endsWith(".pptx") || name.endsWith(".ppt")) return "pptx";
  if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv")) return "txt";
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name)) return "imagem";
  if (/\.(mp4|mov|avi|mkv|webm)$/.test(name)) return "video";
  if (file.type.startsWith("image/")) return "imagem";
  if (file.type.startsWith("video/")) return "video";
  return "txt";
}

function fromPlainText(text: string, type: ContentFileType, fileName?: string, fileSize?: number): ExtractionResult {
  const clean = cleanExtractedText(text);
  const paragraphs = splitParagraphs(clean);
  return {
    sections: paragraphs.map((p, i) => ({ text: p, locator: `parágrafo ${i + 1}` })),
    text: clean,
    notes: [],
    needsManualText: clean.length < 40,
    detectedType: type,
    fileName,
    fileSize,
  };
}

/** Texto digitado/colado pelo administrador. */
export function extractFromText(text: string): ExtractionResult {
  return fromPlainText(text, "texto");
}

/**
 * Conteúdo a partir de uma URL. Observação honesta: o navegador só
 * consegue ler páginas que liberam CORS. Quando não conseguir, o
 * administrador cola o texto — e a URL fica registrada como fonte.
 */
export async function extractFromUrl(url: string): Promise<ExtractionResult> {
  try {
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) throw new Error(`resposta ${response.status}`);
    const html = await response.text();
    const body = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&");
    const result = fromPlainText(body, "url");
    return { ...result, notes: [`Texto obtido de ${url}. Confira se o conteúdo corresponde à página.`] };
  } catch (error) {
    return {
      sections: [],
      text: "",
      notes: [
        `Não foi possível ler a página automaticamente (${error instanceof Error ? error.message : "erro de rede/CORS"}).`,
        "Cole o texto no campo de conteúdo. A URL continua registrada como fonte.",
      ],
      needsManualText: true,
      detectedType: "url",
    };
  }
}

/** Extrai o texto de um arquivo, escolhendo o extrator adequado. */
export async function extractFromFile(file: File, options: { password?: string } = {}): Promise<ExtractionResult> {
  const type = detectFileType(file);
  if (type === "pdf") {
    const { extractPdf } = await import("./pdf");
    return extractPdf(file, options);
  }
  if (type === "docx") {
    const { extractDocx } = await import("./office");
    return extractDocx(file);
  }
  if (type === "pptx") {
    const { extractPptx } = await import("./office");
    return extractPptx(file);
  }
  if (type === "imagem" || type === "video") {
    return {
      sections: [],
      text: "",
      notes: [
        type === "imagem"
          ? "Imagem recebida. Imagem não tem texto para analisar: descreva o conteúdo no campo de descrição (ou cole o texto) para que a plataforma possa gerar aula, quiz e jogos a partir dela."
          : "Vídeo recebido. Para gerar conteúdo educacional, cole a transcrição ou um resumo do vídeo no campo de conteúdo.",
      ],
      needsManualText: true,
      detectedType: type,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    };
  }
  const text = await file.text();
  return fromPlainText(text, "txt", file.name, file.size);
}
