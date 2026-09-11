// =====================================================================
// INTEGRAÇÃO FUTURA COM O ERP CONSERV (seção 39)
// ---------------------------------------------------------------------
// Este arquivo é o CONTRATO da integração. Ele já define:
//   · o formato dos dados que a Academia espera do ERP;
//   · como esses dados viram recomendação de treinamento;
//   · o ponto exato onde a chamada HTTP entra (fetchFromErp).
//
// Enquanto a integração estiver desligada, nada aqui é chamado em
// produção — e a Academia funciona inteira sem o ERP.
//
// Quando ligar: implemente os endpoints no ERP (ou numa função
// serverless que leia o banco do ERP) e configure a URL em
// Configurações → ERP ConServ.
// =====================================================================

import type { ID, Recommendation } from "../../core/types";
import { catalogRepo, peopleRepo, settingsRepo } from "../../data/repositories";
import { competencyEngine } from "../../engines/competency/CompetencyEngine";
import { normalize } from "../../core/text";

/** Dados que a Academia espera receber do ERP. */
export interface ErpOperationPerformance {
  employeeCode: string;
  /** Código/nome da operação na ordem de produção (ex.: "Pregar gola"). */
  operation: string;
  machine?: string;
  /** Peças por hora realizadas x meta. */
  achieved: number;
  target: number;
  /** Índice de retrabalho/refugo da operação (0–1). */
  reworkRate?: number;
  period: { from: string; to: string };
}

export interface ErpMachineEvent {
  machineId: string;
  machineType: string;
  event: "parada" | "manutencao" | "regulagem" | "quebra";
  description: string;
  at: string;
  employeeCode?: string;
}

export interface ErpQualityEvent {
  orderId: string;
  defect: string;
  sector: string;
  employeeCode?: string;
  quantity: number;
  at: string;
}

export interface ErpSyncResult {
  performance: ErpOperationPerformance[];
  machineEvents: ErpMachineEvent[];
  qualityEvents: ErpQualityEvent[];
  fetchedAt: string;
}

/** Mapa de palavra-chave → competência, usado para ligar ERP e Academia. */
const OPERATION_COMPETENCIES: Array<{ keywords: string[]; competencyId: ID }> = [
  { keywords: ["overloque", "fechar", "ombro", "lateral", "gola"], competencyId: "CMP-OVERLOQUE" },
  { keywords: ["reta", "pesponto", "bolso", "travete"], competencyId: "CMP-RETA" },
  { keywords: ["galoneira", "barra", "galao"], competencyId: "CMP-GALONEIRA" },
  { keywords: ["interlock", "fechamento"], competencyId: "CMP-INTERLOCK" },
  { keywords: ["regulagem", "tensao", "diferencial", "ajuste"], competencyId: "CMP-REGULAGEM" },
  { keywords: ["corte", "enfesto", "risco"], competencyId: "CMP-ENFESTO" },
  { keywords: ["silk", "estampa", "tela", "cura"], competencyId: "CMP-SILK-IMPRESSAO" },
  { keywords: ["embalagem", "dobra", "expedicao"], competencyId: "CMP-EMBALAGEM" },
  { keywords: ["revisao", "defeito", "inspecao"], competencyId: "CMP-QUALIDADE" },
];

function competencyOfOperation(operation: string, machine?: string): ID | undefined {
  const haystack = normalize(`${operation} ${machine ?? ""}`);
  for (const entry of OPERATION_COMPETENCIES) {
    if (entry.keywords.some((keyword) => haystack.includes(normalize(keyword)))) return entry.competencyId;
  }
  return undefined;
}

export const erpBridge = {
  enabled(): boolean {
    const settings = settingsRepo.get();
    return settings.erpIntegration.enabled && settings.erpIntegration.baseUrl.trim().length > 0;
  },

  capabilities() {
    return [
      { id: "producao", label: "Produção e ordens", description: "Ler operações, tempos e metas por colaborador." },
      { id: "maquinas", label: "Máquinas e horímetro", description: "Relacionar paradas e regulagens com treinamento de regulagem/manutenção." },
      { id: "qualidade", label: "Qualidade", description: "Usar defeitos registrados no ERP para indicar o treinamento certo." },
      { id: "colaboradores", label: "Colaboradores", description: "Sincronizar matrícula, setor, função e admissão (fonte única no ERP)." },
      { id: "ficha", label: "Ficha técnica", description: "Trazer medidas e especificações para as aulas e quizzes de qualidade." },
      { id: "competencias", label: "Competências", description: "Devolver ao ERP o nível de competência por colaborador para alocação." },
    ];
  },

  /**
   * PONTO DE INTEGRAÇÃO: a chamada real ao ERP entra aqui.
   * Mantemos o retorno tipado para que o resto do motor não mude.
   */
  async sync(): Promise<ErpSyncResult | null> {
    const settings = settingsRepo.get();
    if (!this.enabled()) return null;
    const base = settings.erpIntegration.baseUrl.replace(/\/$/, "");
    try {
      const response = await fetch(`${base}/academia/sync`, {
        headers: { Authorization: `Bearer ${settings.erpIntegration.apiKey}` },
      });
      if (!response.ok) throw new Error(`ERP respondeu ${response.status}`);
      const data = (await response.json()) as Partial<ErpSyncResult>;
      return {
        performance: data.performance ?? [],
        machineEvents: data.machineEvents ?? [],
        qualityEvents: data.qualityEvents ?? [],
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.warn("[Academia] integração ERP indisponível:", error);
      return null;
    }
  },

  /**
   * Converte desempenho do ERP em recomendação de treinamento.
   * Exemplo da seção 39: colaborador com dificuldade numa operação →
   * curso + módulo + desafio correspondentes.
   */
  recommendationsFromPerformance(data: ErpOperationPerformance[]): Array<{ employeeId: ID; recommendations: Recommendation[] }> {
    const out: Array<{ employeeId: ID; recommendations: Recommendation[] }> = [];
    for (const item of data) {
      const employee = peopleRepo.employeeByCode(item.employeeCode);
      if (!employee) continue;
      const ratio = item.target === 0 ? 1 : item.achieved / item.target;
      const rework = item.reworkRate ?? 0;
      if (ratio >= 0.9 && rework < 0.03) continue;

      const competencyId = competencyOfOperation(item.operation, item.machine);
      const recommendations: Recommendation[] = [];
      if (competencyId) {
        for (const course of catalogRepo.coursesOfCompetency(competencyId)) {
          recommendations.push({
            id: `erp-${employee.id}-${course.id}`,
            kind: "curso",
            title: course.title,
            reason: `Operação "${item.operation}" em ${Math.round(ratio * 100)}% da meta${rework > 0 ? ` e ${Math.round(rework * 100)}% de retrabalho` : ""}`,
            refId: course.id,
            priority: rework > 0.05 ? 10 : 8,
            link: `/curso/${course.id}`,
          });
        }
        for (const game of catalogRepo.publishedGames().filter((g) => g.competencies.includes(competencyId))) {
          recommendations.push({
            id: `erp-${employee.id}-${game.id}`,
            kind: "jogo",
            title: game.title,
            reason: `Treino prático para "${item.operation}"`,
            refId: game.id,
            priority: 6,
            link: `/jogos/${game.id}`,
          });
        }
        const challenge = catalogRepo.publishedChallenges().find((c) => c.competencies.includes(competencyId));
        if (challenge) {
          recommendations.push({
            id: `erp-${employee.id}-${challenge.id}`,
            kind: "desafio",
            title: challenge.title,
            reason: "Decisão prática ligada à operação",
            refId: challenge.id,
            priority: 5,
            link: `/desafio/${challenge.id}`,
          });
        }
      }
      if (recommendations.length > 0) out.push({ employeeId: employee.id, recommendations });
    }
    return out;
  },

  /** Competências por colaborador, no formato que o ERP consumiria. */
  exportCompetencies() {
    return peopleRepo.activeEmployees().map((employee) => ({
      employeeCode: employee.code,
      name: employee.name,
      competencies: competencyEngine
        .matrixOf(employee.id)
        .get("Costura")
        ?.map((item) => ({ competency: item.name, level: item.level, target: item.target })) ?? [],
    }));
  },
};
