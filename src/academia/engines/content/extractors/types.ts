import type { ContentFileType } from "../../../core/types";

export interface ExtractedSection {
  text: string;
  /** Onde o trecho estava: "página 3", "slide 2", "parágrafo 7"… */
  locator?: string;
}

/**
 * Por que a leitura não deu certo — a tela usa isto para oferecer a
 * saída certa (pedir a senha, avisar que o arquivo não é um PDF…) em vez
 * de só dizer "falhou".
 */
export type ExtractionProblem = "senha" | "arquivo_invalido" | "sem_texto" | "falha";

export interface ExtractionResult {
  sections: ExtractedSection[];
  text: string;
  /** Observações para o administrador (ex.: PDF sem texto, só imagem). */
  notes: string[];
  /** true quando não foi possível obter texto utilizável. */
  needsManualText: boolean;
  detectedType: ContentFileType;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  problem?: ExtractionProblem;
  /** Mensagem técnica original — serve para relatar o problema. */
  technicalDetail?: string;
}

export interface Extractor {
  readonly label: string;
  supports(file: File): boolean;
  extract(file: File): Promise<ExtractionResult>;
}
