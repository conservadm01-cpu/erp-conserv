import { unzipSync, strFromU8 } from "fflate";
import type { ExtractedSection, ExtractionResult } from "./types";
import { cleanExtractedText } from "../../../core/text";

// DOCX e PPTX são pacotes ZIP com XML dentro. Lemos o XML e tiramos o
// texto mantendo a divisão por parágrafo (docx) e por slide (pptx).

function xmlToText(xml: string, paragraphTag: string): string {
  return xml
    .replace(new RegExp(`</${paragraphTag}>`, "g"), "\n\n")
    .replace(/<a:br\/>|<w:br\/>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export async function extractDocx(file: File): Promise<ExtractionResult> {
  const notes: string[] = [];
  const sections: ExtractedSection[] = [];
  try {
    const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
    const doc = files["word/document.xml"];
    if (!doc) throw new Error("documento sem word/document.xml");
    const raw = xmlToText(strFromU8(doc), "w:p");
    raw.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0)
      .forEach((paragraph, index) => sections.push({ text: paragraph, locator: `parágrafo ${index + 1}` }));
  } catch (error) {
    notes.push(`Falha ao ler o DOCX: ${error instanceof Error ? error.message : "erro desconhecido"}.`);
  }
  const text = cleanExtractedText(sections.map((s) => s.text).join("\n\n"));
  return {
    sections, text, notes, needsManualText: text.length < 40, detectedType: "docx",
    fileName: file.name, fileSize: file.size, mimeType: file.type,
  };
}

export async function extractPptx(file: File): Promise<ExtractionResult> {
  const notes: string[] = [];
  const sections: ExtractedSection[] = [];
  try {
    const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
    const slideNames = Object.keys(files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => Number(/(\d+)/.exec(a)?.[1] ?? 0) - Number(/(\d+)/.exec(b)?.[1] ?? 0));
    for (const name of slideNames) {
      const index = Number(/(\d+)/.exec(name)?.[1] ?? 0);
      const slideText = xmlToText(strFromU8(files[name]), "a:p")
        .split(/\n+/).map((l) => l.trim()).filter(Boolean).join("\n");
      if (slideText.length > 0) sections.push({ text: slideText.replace(/\n/g, " · "), locator: `slide ${index}` });
    }
    if (sections.length === 0) notes.push("Nenhum texto encontrado nos slides (apresentação só com imagens?).");
  } catch (error) {
    notes.push(`Falha ao ler o PPTX: ${error instanceof Error ? error.message : "erro desconhecido"}.`);
  }
  const text = cleanExtractedText(sections.map((s) => s.text).join("\n\n"));
  return {
    sections, text, notes, needsManualText: text.length < 40, detectedType: "pptx",
    fileName: file.name, fileSize: file.size, mimeType: file.type,
  };
}
