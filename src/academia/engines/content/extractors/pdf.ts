import type { ExtractedSection, ExtractionResult } from "./types";
import { cleanExtractedText } from "../../../core/text";

/**
 * Carrega o pdfjs pronto para ler no PRÓPRIO thread da página.
 *
 * Ler PDF exige um "ajudante" (worker). Por padrão o pdfjs tenta criar
 * esse ajudante a partir de um arquivo separado — e é aí que a leitura
 * quebrava fora do servidor da ConServ: em página embutida ou publicada,
 * o navegador bloqueia a criação do worker e o erro não aparecia para
 * ninguém. Registrando o ajudante aqui, a leitura roda no thread da
 * página: funciona em qualquer hospedagem e não depende de nenhum
 * arquivo extra ser publicado junto.
 */
async function carregarLeitor() {
  const pdfjs = await import("pdfjs-dist");
  const ajudante = await import("pdfjs-dist/build/pdf.worker.min.mjs");
  const escopo = globalThis as typeof globalThis & { pdfjsWorker?: unknown };
  escopo.pdfjsWorker ??= ajudante;
  return pdfjs;
}

/**
 * Extração de texto de PDF no próprio navegador (pdfjs), uma seção por
 * página — é esse localizador ("página 3") que o SOURCE_ID guarda.
 *
 * PDF que é só imagem digitalizada não tem texto: nesse caso avisamos o
 * administrador para colar o conteúdo ou enviar a versão digital.
 * (OCR seria o próximo passo — ponto de extensão.)
 */
export async function extractPdf(file: File): Promise<ExtractionResult> {
  const notes: string[] = [];
  const sections: ExtractedSection[] = [];
  let totalPaginas = 0;
  try {
    const pdfjs = await carregarLeitor();
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      // Só queremos o texto: nada de renderizar, avaliar código ou baixar
      // fontes. Também evita esbarrar na política de segurança das
      // páginas publicadas, que proíbe execução dinâmica de código.
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
    }).promise;
    totalPaginas = pdf.numPages;
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
      notes.push(
        `Este PDF tem ${totalPaginas} página(s), mas nenhuma delas tem texto selecionável — ` +
        "provavelmente é um documento digitalizado (foto ou escâner). Cole o conteúdo no campo " +
        "de texto abaixo, ou envie a versão digital do arquivo.",
      );
    } else if (totalPaginas > sections.length) {
      notes.push(`${totalPaginas - sections.length} página(s) sem texto extraível foram ignoradas.`);
    }
  } catch (error) {
    // Mensagem técnica junto: sem ela, quem está na tela não tem como
    // dizer o que aconteceu nem pedir ajuda.
    notes.push(
      `Não foi possível ler este PDF (${error instanceof Error ? error.message : "erro desconhecido"}). ` +
      "Cole o conteúdo no campo de texto abaixo para seguir com a análise.",
    );
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
