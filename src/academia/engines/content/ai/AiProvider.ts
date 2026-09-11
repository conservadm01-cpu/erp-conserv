// =====================================================================
// CAMADA DE IA — ponto de conexão (seções 9, 24 e 36)
// ---------------------------------------------------------------------
// A plataforma nunca chama uma IA diretamente: ela chama um
// ContentAnalyzer. Hoje existem duas implementações:
//
//   1. HeuristicAnalyzer  — roda no navegador, sem depender de rede.
//   2. RemoteAiProvider   — chama uma API externa (ponto de integração).
//
// Regras de IA que valem para QUALQUER implementação (seção 24):
//   · usar somente o conteúdo autorizado que recebeu;
//   · preservar a fonte (SOURCE_ID) de cada item gerado;
//   · não inventar informação técnica;
//   · sinalizar o que é incerto (SourceRef.uncertain + warnings);
//   · nada é publicado sem revisão humana.
// =====================================================================

import type { AiSettings, ContentAnalysis, ContentItem } from "../../../core/types";

export interface ContentAnalyzer {
  /** Nome exibido na tela de análise (rastreabilidade do provedor). */
  readonly name: string;
  analyze(content: ContentItem, settings: AiSettings): Promise<ContentAnalysis>;
}

/** Contrato esperado da API externa, quando a empresa conectar uma. */
export interface RemoteAnalysisRequest {
  contentId: string;
  title: string;
  category: string;
  level: string;
  /** Apenas os trechos autorizados, com seus SOURCE_IDs. */
  chunks: Array<{ sourceId: string; text: string; locator?: string }>;
  settings: AiSettings;
  /** Instruções fixas que a API deve respeitar. */
  policy: string[];
}

export const AI_POLICY: string[] = [
  "Use somente o conteúdo enviado nesta requisição. Não acrescente informação externa.",
  "Todo item gerado deve citar o SOURCE_ID do trecho que o sustenta.",
  "Não invente dados técnicos, números, normas ou procedimentos.",
  "Marque como incerto (uncertain=true) qualquer item sem base literal no trecho.",
  "Não transforme material educativo em aconselhamento jurídico e não crie requisito legal inexistente.",
  "Escreva em português do Brasil, linguagem simples e direta, para o público da produção.",
];

/**
 * Provedor remoto de IA. Implementado como ponto de integração: o
 * endpoint e o modelo vêm das configurações (painel admin → IA).
 * Enquanto não houver endpoint configurado, o sistema usa o analisador
 * local — a plataforma funciona inteira sem IA externa.
 */
export class RemoteAiProvider implements ContentAnalyzer {
  readonly name: string;

  constructor(private endpoint: string, private model: string, private fallback: ContentAnalyzer) {
    this.name = `IA externa (${model || "modelo não informado"})`;
  }

  async analyze(content: ContentItem, settings: AiSettings): Promise<ContentAnalysis> {
    const payload: RemoteAnalysisRequest = {
      contentId: content.id,
      title: content.title,
      category: content.category,
      level: content.level,
      chunks: content.chunks.map((c) => ({ sourceId: c.sourceId, text: c.text, locator: c.locator })),
      settings,
      policy: AI_POLICY,
    };
    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: this.model, ...payload }),
      });
      if (!response.ok) throw new Error(`IA externa respondeu ${response.status}`);
      const data = (await response.json()) as Partial<ContentAnalysis>;
      const local = await this.fallback.analyze(content, settings);
      // A resposta externa enriquece a análise local; a local garante que
      // rastreabilidade e estrutura existam mesmo com resposta parcial.
      return {
        ...local,
        ...data,
        provider: this.name,
        warnings: [
          ...(data.warnings ?? []),
          ...local.warnings,
          "Análise enriquecida por IA externa — revisão humana obrigatória antes de publicar.",
        ],
      } as ContentAnalysis;
    } catch (error) {
      const local = await this.fallback.analyze(content, settings);
      return {
        ...local,
        warnings: [
          `Não foi possível falar com a IA externa (${error instanceof Error ? error.message : "erro desconhecido"}). A análise abaixo é do analisador local.`,
          ...local.warnings,
        ],
      };
    }
  }
}
