import type { ExtractedSection, ExtractionResult } from "./types";
import { cleanExtractedText } from "../../../core/text";

/**
 * Extração de texto de PDF no próprio navegador (pdfjs). PDF que é só
 * imagem escaneada não tem texto: nesse caso avisamos o administrador
 * para colar o conteúdo ou enviar a versão digital.
 * (OCR seria o próximo passo — ponto de extensão.)
 */
export async function extractPdf(file: File): Promise<ExtractionResult> {
  const notes: string[] = [];
  const sections: ExtractedSection[] = [];
  try {
    const pdfjs = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (pageText.length > 0) sections.push({ text: pageText, locator: `página ${pageNumber}` });
    }
    if (sections.length === 0) {
      notes.push("Este PDF não tem texto selecionável (provavelmente é digitalizado como imagem). Cole o conteúdo no campo de texto ou envie a versão digital.");
    }
    if (pdf.numPages > sections.length && sections.length > 0) {
      notes.push(`${pdf.numPages - sections.length} página(s) sem texto extraível foram ignoradas.`);
    }
  } catch (error) {
    notes.push(`Falha ao ler o PDF: ${error instanceof Error ? error.message : "erro desconhecido"}.`);
  }
  const text = cleanExtractedText(sections.map((s) => s.text).join("\n\n"));
  return {
    sections,
    text,
    notes,
    needsManualText: text.length < 40,
    detectedType: "pdf",
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || "application/pdf",
  };
}
