import type { ExtractedSection, ExtractionProblem, ExtractionResult } from "./types";
import { cleanExtractedText } from "../../../core/text";

/**
 * Carrega o pdfjs pronto para ler no PRÓPRIO thread da página.
 *
 * Ler PDF exige um "ajudante" (worker). Por padrão o pdfjs tenta criar
 * esse ajudante a partir de um arquivo separado — e isso não funciona em
 * toda hospedagem. Registrando o ajudante aqui, a leitura roda no thread
 * da página: funciona em qualquer lugar e não depende de nenhum arquivo
 * extra ser publicado junto. Medido: 40 páginas em 0,2 s.
 */
async function carregarLeitor() {
  const pdfjs = await import("pdfjs-dist");
  const ajudante = await import("pdfjs-dist/build/pdf.worker.min.mjs");
  const escopo = globalThis as typeof globalThis & { pdfjsWorker?: unknown };
  escopo.pdfjsWorker ??= ajudante;
  return pdfjs;
}

/** Traduz a falha do pdfjs para algo que a tela saiba tratar. */
function interpretarFalha(error: unknown): { problem: ExtractionProblem; note: string; detail: string } {
  const nome = (error as { name?: string })?.name ?? "";
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error);

  if (nome === "PasswordException" || /password/i.test(detail)) {
    return {
      problem: "senha",
      note: "Este PDF está protegido por senha. Informe a senha do arquivo para a plataforma conseguir ler.",
      detail,
    };
  }
  if (nome === "InvalidPDFException" || /invalid pdf|not a pdf/i.test(detail)) {
    return {
      problem: "arquivo_invalido",
      note:
        "Este arquivo não abre como PDF. Costuma ser um download incompleto, um arquivo de outro " +
        "formato renomeado para .pdf, ou um PDF danificado. Tente abrir o arquivo no computador: se " +
        "ele abrir, salve de novo (Imprimir → Salvar como PDF) e envie a cópia.",
      detail,
    };
  }
  return {
    problem: "falha",
    note: `Não foi possível ler este PDF (${detail}). Cole o conteúdo no campo de texto abaixo para seguir com a análise.`,
    detail,
  };
}

/**
 * Extração de texto de PDF no próprio navegador (pdfjs), uma seção por
 * página — é esse localizador ("página 3") que o SOURCE_ID guarda.
 *
 * PDF que é só imagem digitalizada não tem texto: nesse caso avisamos o
 * administrador para colar o conteúdo ou enviar a versão digital.
 * (OCR seria o próximo passo — ponto de extensão.)
 */
export async function extractPdf(file: File, options: { password?: string } = {}): Promise<ExtractionResult> {
  const notes: string[] = [];
  const sections: ExtractedSection[] = [];
  let problem: ExtractionProblem | undefined;
  let technicalDetail: string | undefined;
  let totalPaginas = 0;

  try {
    const pdfjs = await carregarLeitor();
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      password: options.password,
      // Só queremos o texto: nada de renderizar, avaliar código ou baixar
      // fontes. Também evita esbarrar na política de segurança das
      // páginas publicadas, que proíbe execução dinâmica de código.
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
    }).promise;
    totalPaginas = pdf.numPages;

    const paginasComFalha: number[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      try {
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        if (pageText.length > 0) sections.push({ text: pageText, locator: `página ${pageNumber}` });
      } catch {
        // Uma página defeituosa não pode derrubar o material inteiro.
        paginasComFalha.push(pageNumber);
      }
    }

    if (paginasComFalha.length) {
      notes.push(`Não foi possível ler ${paginasComFalha.length} página(s): ${paginasComFalha.join(", ")}.`);
    }
    if (sections.length === 0) {
      problem = "sem_texto";
      notes.push(
        `Este PDF tem ${totalPaginas} página(s), mas nenhuma delas tem texto selecionável — ` +
        "provavelmente é um documento digitalizado (foto ou escâner). Cole o conteúdo no campo " +
        "de texto abaixo, ou envie a versão digital do arquivo.",
      );
    } else if (totalPaginas > sections.length + paginasComFalha.length) {
      const vazias = totalPaginas - sections.length - paginasComFalha.length;
      notes.push(`${vazias} página(s) sem texto (imagem ou em branco) foram ignoradas.`);
    }
  } catch (error) {
    const falha = interpretarFalha(error);
    problem = falha.problem;
    technicalDetail = falha.detail;
    notes.push(falha.note);
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
    problem,
    technicalDetail,
  };
}
