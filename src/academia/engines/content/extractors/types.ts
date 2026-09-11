import type { ContentFileType } from "../../../core/types";

export interface ExtractedSection {
  text: string;
  /** Onde o trecho estava: "página 3", "slide 2", "parágrafo 7"… */
  locator?: string;
}

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
}

export interface Extractor {
  readonly label: string;
  supports(file: File): boolean;
  extract(file: File): Promise<ExtractionResult>;
}
