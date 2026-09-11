import type { LibrarySource } from "../../core/types";

/**
 * Biblioteca de fontes (seção 25). A base normativa prioriza fontes
 * oficiais do Ministério do Trabalho e Emprego; o restante é material
 * técnico de instituições e fabricantes.
 *
 * O endereço e a data de acesso devem ser confirmados pelo responsável
 * técnico antes de publicar conteúdo que dependa da fonte.
 */
export const SEED_SOURCES: LibrarySource[] = [
  {
    id: "SRCLIB-MTE-NR1",
    name: "NR-1 — Disposições Gerais e Gerenciamento de Riscos Ocupacionais",
    url: "https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadoras",
    institution: "Ministério do Trabalho e Emprego (MTE)",
    type: "legislacao",
    reliability: "oficial",
    subjects: ["NR-1", "GRO", "PGR", "riscos ocupacionais", "segurança do trabalho"],
    notes: "Fonte primária para todo conteúdo de NR-1. Verificar sempre a redação vigente e as portarias de alteração.",
  },
  {
    id: "SRCLIB-MTE-NR12",
    name: "NR-12 — Segurança no Trabalho em Máquinas e Equipamentos",
    url: "https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadoras",
    institution: "Ministério do Trabalho e Emprego (MTE)",
    type: "legislacao",
    reliability: "oficial",
    subjects: ["máquinas", "proteções", "segurança", "manutenção"],
    notes: "Referência para proteções de máquinas de costura e corte.",
  },
  {
    id: "SRCLIB-MTE-NR17",
    name: "NR-17 — Ergonomia",
    url: "https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadoras",
    institution: "Ministério do Trabalho e Emprego (MTE)",
    type: "legislacao",
    reliability: "oficial",
    subjects: ["ergonomia", "posto de trabalho", "pausas", "mobiliário"],
  },
  {
    id: "SRCLIB-SENAI-VEST",
    name: "SENAI — Cursos e material técnico de vestuário",
    url: "https://www.senai.br",
    institution: "SENAI",
    type: "instituicao",
    reliability: "tecnica",
    subjects: ["costura", "modelagem", "corte", "processos de confecção"],
  },
  {
    id: "SRCLIB-ABIT",
    name: "ABIT — Associação Brasileira da Indústria Têxtil e de Confecção",
    url: "https://www.abit.org.br",
    institution: "ABIT",
    type: "instituicao",
    reliability: "referencia",
    subjects: ["indústria têxtil", "mercado", "sustentabilidade", "cadeia produtiva"],
  },
  {
    id: "SRCLIB-GROZ",
    name: "Groz-Beckert — Catálogo técnico de agulhas industriais",
    url: "https://www.groz-beckert.com",
    institution: "Groz-Beckert",
    type: "fabricante",
    reliability: "fabricante",
    subjects: ["agulhas", "pontas", "numeração", "tecidos", "defeitos de costura"],
  },
  {
    id: "SRCLIB-COATS",
    name: "Coats — Biblioteca técnica de linhas e costura",
    url: "https://www.coats.com",
    institution: "Coats",
    type: "fabricante",
    reliability: "fabricante",
    subjects: ["linhas", "título", "tensão", "resistência da costura", "tipos de ponto"],
  },
  {
    id: "SRCLIB-JUKI",
    name: "JUKI — Manuais de instrução de máquinas industriais",
    url: "https://www.juki.co.jp/industrial_e/",
    institution: "JUKI",
    type: "manual",
    reliability: "fabricante",
    subjects: ["overloque", "reta", "regulagem", "manutenção", "lubrificação"],
  },
  {
    id: "SRCLIB-BROTHER",
    name: "Brother — Manuais técnicos de máquinas de costura industrial",
    url: "https://www.brother.com/industrial/",
    institution: "Brother",
    type: "manual",
    reliability: "fabricante",
    subjects: ["galoneira", "interlock", "regulagem", "manutenção"],
  },
  {
    id: "SRCLIB-ABNT-ISO9001",
    name: "ABNT NBR ISO 9001 — Sistemas de gestão da qualidade",
    url: "https://www.abnt.org.br",
    institution: "ABNT",
    type: "norma",
    reliability: "oficial",
    subjects: ["qualidade", "processo", "inspeção", "melhoria contínua"],
    notes: "Usada apenas como referência conceitual de qualidade e processo.",
  },
  {
    id: "SRCLIB-CONSERV-POP",
    name: "ConServ Confecções — Procedimentos Operacionais Padrão (POP) internos",
    institution: "ConServ Confecções",
    type: "interno",
    reliability: "interna",
    subjects: ["procedimentos", "qualidade", "embalagem", "corte", "costura"],
    notes: "Material interno. Prevalece sobre referências externas quando trata de prática da casa.",
  },
  {
    id: "SRCLIB-CONSERV-CULTURA",
    name: "ConServ Confecções — Manual de Cultura e Conduta",
    institution: "ConServ Confecções",
    type: "interno",
    reliability: "interna",
    subjects: ["cultura", "conduta", "comunicação", "organização"],
  },
];
