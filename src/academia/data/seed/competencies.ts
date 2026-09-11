import type { Competency, CompetencyLevel } from "../../core/types";

/**
 * Matriz de competências da ConServ (seção 14).
 * Níveis: 1 Conhecimento · 2 Básico · 3 Operacional · 4 Avançado ·
 *         5 Especialista · 6 Mestre
 * O administrador pode criar novas competências pelo painel.
 */
function levels(subject: string, custom?: Partial<Record<CompetencyLevel, string>>): Record<CompetencyLevel, string> {
  return {
    1: `Sabe o que é ${subject} e por que isso importa para o resultado da peça.`,
    2: `Executa ${subject} em tarefas simples, com acompanhamento.`,
    3: `Executa ${subject} no dia a dia com autonomia, dentro do padrão e do tempo.`,
    4: `Resolve situações difíceis de ${subject}, identifica causas e orienta colegas.`,
    5: `É referência em ${subject}: padroniza, treina e melhora o processo.`,
    6: `Nível mestre em ${subject}: desenvolve métodos, forma multiplicadores e sustenta o padrão da fábrica.`,
    ...custom,
  };
}

const raw: Array<Omit<Competency, "levelDescriptors" | "developedBy"> & { subject: string }> = [
  // ---- Costura ----
  { id: "CMP-RETA", code: "COST-RETA", name: "Máquina Reta", area: "Costura", description: "Operação da máquina reta (1 agulha) com qualidade e tempo.", subject: "a operação da máquina reta" },
  { id: "CMP-OVERLOQUE", code: "COST-OVER", name: "Overloque", area: "Costura", description: "Operação e ajuste da overloque (2 e 3 fios, com faca).", subject: "a operação da overloque" },
  { id: "CMP-GALONEIRA", code: "COST-GALO", name: "Galoneira", area: "Costura", description: "Operação da galoneira em barras, golas e acabamentos.", subject: "a operação da galoneira" },
  { id: "CMP-INTERLOCK", code: "COST-INTER", name: "Interlock", area: "Costura", description: "Operação da interlock em fechamento e travete de malha.", subject: "a operação da interlock" },
  { id: "CMP-REGULAGEM", code: "COST-REG", name: "Regulagem de Máquina", area: "Costura", description: "Tensão, ponto, diferencial, pressão do calcador e faca.", subject: "a regulagem de máquina" },
  { id: "CMP-AGULHA-LINHA", code: "COST-AGL", name: "Agulhas e Linhas", area: "Costura", description: "Escolha de agulha e linha conforme tecido e operação.", subject: "a escolha de agulha e linha" },
  { id: "CMP-SEQ-OPERACIONAL", code: "COST-SEQ", name: "Sequência Operacional", area: "Costura", description: "Ordem correta das operações de montagem da peça.", subject: "a sequência operacional" },
  { id: "CMP-FICHA-TECNICA", code: "GER-FICHA", name: "Leitura de Ficha Técnica", area: "Técnico", description: "Interpretação de ficha técnica, medidas e especificações.", subject: "a leitura de ficha técnica" },

  // ---- Corte e modelagem ----
  { id: "CMP-ENFESTO", code: "CORT-ENF", name: "Enfesto", area: "Corte", description: "Montagem do enfesto sem tensão, com alinhamento e folhas corretas.", subject: "o enfesto" },
  { id: "CMP-RISCO-ENCAIXE", code: "CORT-RISC", name: "Risco e Encaixe", area: "Corte", description: "Encaixe do molde com aproveitamento e respeito ao sentido do fio.", subject: "o risco e o encaixe" },
  { id: "CMP-CORTE-MAQUINA", code: "CORT-MAQ", name: "Corte e Separação", area: "Corte", description: "Corte preciso, identificação e separação por lote e tamanho.", subject: "o corte e a separação de lotes" },
  { id: "CMP-APROVEITAMENTO", code: "CORT-APR", name: "Aproveitamento de Tecido", area: "Corte", description: "Redução de desperdício e controle de sobras.", subject: "o aproveitamento de tecido" },
  { id: "CMP-MODELAGEM", code: "MOD-BASE", name: "Modelagem Base", area: "Modelagem", description: "Construção de molde base a partir de medidas e tabela.", subject: "a modelagem base" },
  { id: "CMP-GRADUACAO", code: "MOD-GRAD", name: "Graduação de Molde", area: "Modelagem", description: "Graduação entre tamanhos mantendo proporção e caimento.", subject: "a graduação de molde" },
  { id: "CMP-MARGEM-COSTURA", code: "MOD-MARG", name: "Margem de Costura", area: "Modelagem", description: "Definição de margens conforme operação e máquina.", subject: "a margem de costura" },

  // ---- Estamparia ----
  { id: "CMP-SILK-TELA", code: "SILK-TELA", name: "Tela e Emulsão", area: "Estamparia", description: "Preparo de tela, emulsão e gravação com qualidade.", subject: "o preparo de tela e emulsão" },
  { id: "CMP-SILK-IMPRESSAO", code: "SILK-IMP", name: "Impressão Silk", area: "Estamparia", description: "Registro, rodo, tinta e cura na impressão em silk screen.", subject: "a impressão em silk screen" },
  { id: "CMP-DTF", code: "EST-DTF", name: "DTF", area: "Estamparia", description: "Impressão DTF, pó, prensa, tempo e temperatura.", subject: "o processo DTF" },
  { id: "CMP-SUBLIMACAO", code: "EST-SUB", name: "Sublimação", area: "Estamparia", description: "Sublimação em poliéster: tempo, temperatura e pressão.", subject: "a sublimação" },

  // ---- Qualidade ----
  { id: "CMP-QUALIDADE", code: "QUAL-INSP", name: "Inspeção de Qualidade", area: "Qualidade", description: "Identificação de defeitos e critérios de aprovação.", subject: "a inspeção de qualidade" },
  { id: "CMP-DEFEITOS", code: "QUAL-DEF", name: "Análise de Defeitos", area: "Qualidade", description: "Relação entre defeito, causa e ação corretiva.", subject: "a análise de defeitos" },
  { id: "CMP-RETRABALHO", code: "QUAL-RET", name: "Prevenção de Retrabalho", area: "Qualidade", description: "Agir na causa antes de o problema virar retrabalho.", subject: "a prevenção de retrabalho" },

  // ---- Segurança e ergonomia ----
  { id: "CMP-NR1", code: "SEG-NR1", name: "NR-1 e GRO", area: "Segurança", description: "Conceitos de perigo, risco, GRO/PGR, direitos e deveres.", subject: "os conceitos da NR-1" },
  { id: "CMP-PERIGO-RISCO", code: "SEG-RISC", name: "Identificação de Perigos", area: "Segurança", description: "Reconhecer perigos e riscos no posto de trabalho.", subject: "a identificação de perigos e riscos" },
  { id: "CMP-EMERGENCIA", code: "SEG-EMER", name: "Emergência", area: "Segurança", description: "Conduta em emergências, rotas de fuga e comunicação.", subject: "a conduta em emergências" },
  { id: "CMP-ERGONOMIA", code: "SEG-ERGO", name: "Ergonomia", area: "Ergonomia", description: "Postura, ajuste do posto, pausas e prevenção de lesões.", subject: "a ergonomia no posto" },
  { id: "CMP-PSICOSSOCIAL", code: "SEG-PSI", name: "Fatores Psicossociais", area: "Segurança", description: "Organização do trabalho, comunicação e respeito no ambiente.", subject: "os fatores psicossociais do trabalho" },

  // ---- Produtividade, organização, cultura ----
  { id: "CMP-PRODUTIVIDADE", code: "PRO-PROD", name: "Produtividade", area: "Produtividade", description: "Método, ritmo, desperdício de movimento e meta.", subject: "a produtividade no posto" },
  { id: "CMP-5S", code: "ORG-5S", name: "5S e Organização", area: "Organização", description: "Os cinco sensos aplicados ao posto e à fábrica.", subject: "o 5S" },
  { id: "CMP-MANUTENCAO", code: "MAN-BAS", name: "Manutenção Básica", area: "Manutenção", description: "Limpeza, lubrificação e cuidados diários com a máquina.", subject: "a manutenção básica" },
  { id: "CMP-EMBALAGEM", code: "EMB-PROC", name: "Embalagem e Expedição", area: "Embalagem", description: "Conferência, dobra, identificação, lote e expedição.", subject: "a embalagem e a expedição" },
  { id: "CMP-SUSTENTABILIDADE", code: "SUS-RES", name: "Sustentabilidade", area: "Sustentabilidade", description: "Resíduos, reaproveitamento, água, energia e consumo.", subject: "a gestão de resíduos e recursos" },
  { id: "CMP-CULTURA", code: "CUL-CONS", name: "Cultura ConServ", area: "Cultura", description: "Orgulho profissional, responsabilidade, cliente e equipe.", subject: "a cultura ConServ" },
  { id: "CMP-COMUNICACAO", code: "CUL-COM", name: "Comunicação", area: "Cultura", description: "Comunicar problemas, pedir apoio e registrar informação.", subject: "a comunicação no trabalho" },
  { id: "CMP-DESENVOLVIMENTO", code: "DES-PROF", name: "Desenvolvimento Profissional", area: "Desenvolvimento", description: "Plano de carreira, aprendizado contínuo e multifuncionalidade.", subject: "o desenvolvimento profissional" },
];

export const SEED_COMPETENCIES: Competency[] = raw.map((c) => ({
  id: c.id,
  code: c.code,
  name: c.name,
  area: c.area,
  description: c.description,
  levelDescriptors: levels(c.subject),
  developedBy: [],
}));
