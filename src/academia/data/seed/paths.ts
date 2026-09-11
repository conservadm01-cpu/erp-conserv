import type { LearningPath } from "../../core/types";

/**
 * As 17 trilhas iniciais (seção 5). O administrador pode criar novas e
 * reordenar pelo painel — trilha é dado, não código.
 * Trilhas sem curso publicado ainda aparecem como "em construção" e
 * servem de destino para os próximos conteúdos enviados.
 */
interface PathSpec {
  n: number;
  id: string;
  code: string;
  title: string;
  description: string;
  icon: string;
  accent: string;
  courseIds?: string[];
  competencies: string[];
  recommendedFor: string[];
  mandatory?: boolean;
}

const SPECS: PathSpec[] = [
  {
    n: 1, id: "PTH-01", code: "CULTURA", title: "Cultura ConServ",
    description: "Quem somos, o que valorizamos e como cada etapa influencia a peça que chega ao cliente.",
    icon: "heart", accent: "copper", competencies: ["CMP-CULTURA", "CMP-COMUNICACAO", "CMP-QUALIDADE"],
    recommendedFor: ["Todos"], mandatory: true,
  },
  {
    n: 2, id: "PTH-02", code: "NR1", title: "Segurança e NR-1",
    description: "Perigo, risco, GRO, PGR, emergência, quase acidente e fatores psicossociais — conteúdo educativo de segurança e saúde.",
    icon: "shield", accent: "copper", courseIds: ["CRS-002"],
    competencies: ["CMP-NR1", "CMP-PERIGO-RISCO", "CMP-EMERGENCIA", "CMP-PSICOSSOCIAL"],
    recommendedFor: ["Todos"], mandatory: true,
  },
  {
    n: 3, id: "PTH-03", code: "CORTE", title: "Corte",
    description: "Enfesto, risco, sentido do fio, encaixe, aproveitamento, identificação e separação de lotes.",
    icon: "ruler", accent: "navy", courseIds: ["CRS-004"],
    competencies: ["CMP-ENFESTO", "CMP-RISCO-ENCAIXE", "CMP-CORTE-MAQUINA", "CMP-APROVEITAMENTO"],
    recommendedFor: ["Cortador / Cortadora"],
  },
  {
    n: 4, id: "PTH-04", code: "MODELAGEM", title: "Modelagem",
    description: "Medidas, tabela, moldes, graduação, margem de costura e interpretação técnica.",
    icon: "pen-tool", accent: "navy",
    competencies: ["CMP-MODELAGEM", "CMP-GRADUACAO", "CMP-MARGEM-COSTURA", "CMP-FICHA-TECNICA"],
    recommendedFor: ["Modelista"],
  },
  {
    n: 5, id: "PTH-05", code: "PREPARACAO", title: "Preparação",
    description: "Separação, conferência de lote, preparo de partes e alimentação da costura.",
    icon: "layers", accent: "sand",
    competencies: ["CMP-SEQ-OPERACIONAL", "CMP-QUALIDADE", "CMP-5S"],
    recommendedFor: ["Auxiliar de Preparação"],
  },
  {
    n: 6, id: "PTH-06", code: "COSTURA", title: "Costura",
    description: "Máquinas, agulhas, linhas, regulagem, sequência operacional e qualidade na montagem.",
    icon: "scissors", accent: "navy", courseIds: ["CRS-001"],
    competencies: ["CMP-RETA", "CMP-OVERLOQUE", "CMP-GALONEIRA", "CMP-REGULAGEM", "CMP-AGULHA-LINHA", "CMP-SEQ-OPERACIONAL"],
    recommendedFor: ["Costureira / Costureiro"], mandatory: true,
  },
  {
    n: 7, id: "PTH-07", code: "SILK", title: "Silk Screen",
    description: "Tela, emulsão, gravação, registro, rodo, tinta, cura e limpeza.",
    icon: "palette", accent: "jade",
    competencies: ["CMP-SILK-TELA", "CMP-SILK-IMPRESSAO"],
    recommendedFor: ["Estampador / Estampadora"],
  },
  {
    n: 8, id: "PTH-08", code: "DTF-SUB", title: "DTF e Sublimação",
    description: "Impressão DTF, pó, prensa, tempo e temperatura; sublimação em poliéster.",
    icon: "printer", accent: "jade",
    competencies: ["CMP-DTF", "CMP-SUBLIMACAO"],
    recommendedFor: ["Estampador / Estampadora"],
  },
  {
    n: 9, id: "PTH-09", code: "MAQUINAS", title: "Máquinas e Regulagem",
    description: "Reta, overloque, galoneira, interlock: funcionamento, ajustes e diagnóstico.",
    icon: "settings", accent: "navy",
    competencies: ["CMP-REGULAGEM", "CMP-RETA", "CMP-OVERLOQUE", "CMP-GALONEIRA", "CMP-INTERLOCK"],
    recommendedFor: ["Costureira / Costureiro", "Mecânico(a) de Máquinas"],
  },
  {
    n: 10, id: "PTH-10", code: "MANUTENCAO", title: "Manutenção",
    description: "Manutenção de primeiro nível, preventiva, lubrificação e limites de atuação.",
    icon: "wrench", accent: "ink",
    competencies: ["CMP-MANUTENCAO", "CMP-REGULAGEM", "CMP-PERIGO-RISCO"],
    recommendedFor: ["Mecânico(a) de Máquinas"],
  },
  {
    n: 11, id: "PTH-11", code: "QUALIDADE", title: "Qualidade",
    description: "Inspeção, defeitos, causas, autocontrole e prevenção de retrabalho.",
    icon: "eye", accent: "jade", courseIds: ["CRS-003"],
    competencies: ["CMP-QUALIDADE", "CMP-DEFEITOS", "CMP-RETRABALHO"],
    recommendedFor: ["Todos"], mandatory: true,
  },
  {
    n: 12, id: "PTH-12", code: "ERGONOMIA", title: "Ergonomia",
    description: "Ajuste do posto, postura, alcance, pausas, iluminação e sinais de alerta.",
    icon: "activity", accent: "copper",
    competencies: ["CMP-ERGONOMIA", "CMP-NR1"],
    recommendedFor: ["Todos"],
  },
  {
    n: 13, id: "PTH-13", code: "PRODUTIVIDADE", title: "Produtividade",
    description: "Método, economia de movimento, desperdícios, ritmo sustentável e metas.",
    icon: "trending-up", accent: "navy",
    competencies: ["CMP-PRODUTIVIDADE", "CMP-5S", "CMP-QUALIDADE"],
    recommendedFor: ["Todos"],
  },
  {
    n: 14, id: "PTH-14", code: "EMBALAGEM", title: "Embalagem",
    description: "Conferência, dobra, quantidade, identificação, lote, embalagem e expedição.",
    icon: "package", accent: "sand",
    competencies: ["CMP-EMBALAGEM", "CMP-QUALIDADE"],
    recommendedFor: ["Auxiliar de Embalagem"],
  },
  {
    n: 15, id: "PTH-15", code: "CINCO-S", title: "5S e Organização",
    description: "Os cinco sensos aplicados ao posto, com sinais de alerta e plano por posto.",
    icon: "sparkles", accent: "sand", courseIds: ["CRS-005"],
    competencies: ["CMP-5S", "CMP-PRODUTIVIDADE"],
    recommendedFor: ["Todos"],
  },
  {
    n: 16, id: "PTH-16", code: "SUSTENTAB", title: "Sustentabilidade",
    description: "Resíduos, reaproveitamento de retalho, consumo de água e energia, descarte correto.",
    icon: "leaf", accent: "jade",
    competencies: ["CMP-SUSTENTABILIDADE", "CMP-APROVEITAMENTO"],
    recommendedFor: ["Todos"],
  },
  {
    n: 17, id: "PTH-17", code: "DESENVOLV", title: "Desenvolvimento Profissional",
    description: "Plano de carreira na ConServ, multifuncionalidade, comunicação e aprendizado contínuo.",
    icon: "graduation-cap", accent: "copper",
    competencies: ["CMP-DESENVOLVIMENTO", "CMP-COMUNICACAO", "CMP-CULTURA"],
    recommendedFor: ["Todos"],
  },
];

export const SEED_PATHS: LearningPath[] = SPECS.map((s) => ({
  id: s.id,
  code: s.code,
  title: s.title,
  description: s.description,
  order: s.n,
  icon: s.icon,
  accent: s.accent,
  courseIds: s.courseIds ?? [],
  competencies: s.competencies,
  recommendedFor: s.recommendedFor,
  mandatory: s.mandatory ?? false,
  status: "published",
  certificateEnabled: (s.courseIds ?? []).length > 0,
  createdAt: "2026-03-02T12:00:00.000Z",
}));
