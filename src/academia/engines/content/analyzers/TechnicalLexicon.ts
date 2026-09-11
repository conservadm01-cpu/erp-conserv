// =====================================================================
// Léxico técnico da confecção
// ---------------------------------------------------------------------
// É o "conhecimento de domínio" do analisador local: permite reconhecer
// termos técnicos num material novo, sugerir categoria, competências e
// nível, e identificar trechos sobre risco e procedimento.
//
// Este léxico é editável (painel admin → Configurações → IA) e serve
// também de dicionário para o provedor remoto de IA, quando ligado.
// =====================================================================

import { normalize } from "../../../core/text";

export interface LexiconEntry {
  term: string;
  /** Variações e sinônimos que aparecem nos materiais. */
  aliases?: string[];
  category: string;
  competencies: string[];
  /** Peso na detecção de categoria do material. */
  weight?: number;
}

export const TECHNICAL_LEXICON: LexiconEntry[] = [
  // Costura / máquinas
  { term: "overloque", aliases: ["overlock", "over"], category: "costura", competencies: ["CMP-OVERLOQUE", "CMP-REGULAGEM"], weight: 3 },
  { term: "galoneira", aliases: ["coverstitch"], category: "costura", competencies: ["CMP-GALONEIRA"], weight: 3 },
  { term: "interlock", category: "costura", competencies: ["CMP-INTERLOCK"], weight: 2 },
  { term: "máquina reta", aliases: ["reta", "ponto corrente"], category: "costura", competencies: ["CMP-RETA"], weight: 2 },
  { term: "tensão", aliases: ["tensor", "tensores"], category: "costura", competencies: ["CMP-REGULAGEM"], weight: 2 },
  { term: "diferencial", category: "costura", competencies: ["CMP-REGULAGEM", "CMP-OVERLOQUE"], weight: 3 },
  { term: "comprimento do ponto", aliases: ["ponto por centímetro", "ppc"], category: "costura", competencies: ["CMP-REGULAGEM"], weight: 2 },
  { term: "calcador", category: "costura", competencies: ["CMP-REGULAGEM"], weight: 2 },
  { term: "looper", aliases: ["loopers", "laçadeira"], category: "costura", competencies: ["CMP-OVERLOQUE"], weight: 2 },
  { term: "faca", category: "costura", competencies: ["CMP-OVERLOQUE", "CMP-MANUTENCAO"], weight: 1 },
  { term: "agulha", aliases: ["agulhas", "ball point", "ponta esférica"], category: "costura", competencies: ["CMP-AGULHA-LINHA"], weight: 2 },
  { term: "linha", aliases: ["linhas", "título", "poliéster texturizado"], category: "costura", competencies: ["CMP-AGULHA-LINHA"], weight: 1 },
  { term: "transporte", aliases: ["dente de transporte", "dentes"], category: "costura", competencies: ["CMP-REGULAGEM"], weight: 1 },
  { term: "sequência operacional", aliases: ["sequencia operacional", "ordem das operações"], category: "costura", competencies: ["CMP-SEQ-OPERACIONAL"], weight: 2 },

  // Corte / modelagem
  { term: "enfesto", aliases: ["enfestar", "colchão"], category: "corte", competencies: ["CMP-ENFESTO"], weight: 3 },
  { term: "risco", aliases: ["encaixe"], category: "corte", competencies: ["CMP-RISCO-ENCAIXE"], weight: 1 },
  { term: "sentido do fio", aliases: ["fio do tecido", "urdume"], category: "corte", competencies: ["CMP-RISCO-ENCAIXE"], weight: 3 },
  { term: "aproveitamento", aliases: ["desperdício", "sobra"], category: "corte", competencies: ["CMP-APROVEITAMENTO"], weight: 2 },
  { term: "lote", aliases: ["identificação", "pacote"], category: "corte", competencies: ["CMP-CORTE-MAQUINA"], weight: 1 },
  { term: "molde", aliases: ["moldes", "graduação", "margem de costura"], category: "modelagem", competencies: ["CMP-MODELAGEM", "CMP-GRADUACAO"], weight: 2 },
  { term: "ficha técnica", aliases: ["tabela de medidas"], category: "tecnico", competencies: ["CMP-FICHA-TECNICA"], weight: 2 },

  // Estamparia
  { term: "tela", aliases: ["mesh", "quadro"], category: "estamparia", competencies: ["CMP-SILK-TELA"], weight: 2 },
  { term: "emulsão", aliases: ["emulsao", "fotolito", "gravação"], category: "estamparia", competencies: ["CMP-SILK-TELA"], weight: 3 },
  { term: "rodo", category: "estamparia", competencies: ["CMP-SILK-IMPRESSAO"], weight: 2 },
  { term: "cura", aliases: ["estufa", "prensa"], category: "estamparia", competencies: ["CMP-SILK-IMPRESSAO"], weight: 2 },
  { term: "registro", category: "estamparia", competencies: ["CMP-SILK-IMPRESSAO"], weight: 1 },
  { term: "dtf", category: "estamparia", competencies: ["CMP-DTF"], weight: 3 },
  { term: "sublimação", aliases: ["sublimacao"], category: "estamparia", competencies: ["CMP-SUBLIMACAO"], weight: 3 },

  // Qualidade
  { term: "defeito", aliases: ["defeitos", "retrabalho", "reprovada"], category: "qualidade", competencies: ["CMP-DEFEITOS", "CMP-QUALIDADE"], weight: 2 },
  { term: "inspeção", aliases: ["inspecao", "revisão", "autocontrole"], category: "qualidade", competencies: ["CMP-QUALIDADE"], weight: 2 },
  { term: "tolerância", aliases: ["tolerancia", "medida"], category: "qualidade", competencies: ["CMP-QUALIDADE", "CMP-FICHA-TECNICA"], weight: 1 },

  // Segurança / ergonomia
  { term: "risco ocupacional", aliases: ["perigo", "gro", "pgr", "inventário de riscos"], category: "seguranca", competencies: ["CMP-NR1", "CMP-PERIGO-RISCO"], weight: 3 },
  { term: "epi", aliases: ["equipamento de proteção individual", "luva", "óculos de proteção"], category: "seguranca", competencies: ["CMP-PERIGO-RISCO"], weight: 2 },
  { term: "nr-1", aliases: ["nr1", "norma regulamentadora"], category: "seguranca", competencies: ["CMP-NR1"], weight: 3 },
  { term: "emergência", aliases: ["emergencia", "rota de fuga", "alarme", "evacuação"], category: "seguranca", competencies: ["CMP-EMERGENCIA"], weight: 2 },
  { term: "acidente", aliases: ["quase acidente", "lesão"], category: "seguranca", competencies: ["CMP-NR1"], weight: 2 },
  { term: "psicossocial", aliases: ["assédio", "organização do trabalho"], category: "seguranca", competencies: ["CMP-PSICOSSOCIAL"], weight: 3 },
  { term: "ergonomia", aliases: ["postura", "cadeira", "alcance", "pausa"], category: "ergonomia", competencies: ["CMP-ERGONOMIA"], weight: 3 },

  // Organização / produtividade / embalagem / sustentabilidade / cultura
  { term: "5s", aliases: ["cinco sensos", "padronização", "disciplina"], category: "organizacao", competencies: ["CMP-5S"], weight: 3 },
  { term: "produtividade", aliases: ["método", "desperdício de movimento", "meta", "ritmo"], category: "produtividade", competencies: ["CMP-PRODUTIVIDADE"], weight: 2 },
  { term: "manutenção", aliases: ["manutencao", "lubrificação", "preventiva"], category: "manutencao", competencies: ["CMP-MANUTENCAO"], weight: 2 },
  { term: "embalagem", aliases: ["dobra", "expedição", "etiqueta", "conferência"], category: "embalagem", competencies: ["CMP-EMBALAGEM"], weight: 3 },
  { term: "resíduo", aliases: ["residuo", "descarte", "reaproveitamento"], category: "sustentabilidade", competencies: ["CMP-SUSTENTABILIDADE"], weight: 2 },
  { term: "cultura", aliases: ["valores", "respeito", "responsabilidade", "orgulho"], category: "cultura", competencies: ["CMP-CULTURA"], weight: 1 },
  { term: "comunicação", aliases: ["comunicacao", "comunicar", "avisar"], category: "cultura", competencies: ["CMP-COMUNICACAO"], weight: 1 },
];

/** Palavras que indicam trecho sobre risco/segurança. */
export const RISK_MARKERS = [
  "risco", "perigo", "acidente", "lesão", "lesao", "epi", "proteção", "protecao", "queda", "choque",
  "queimadura", "corte", "emergência", "emergencia", "nunca", "proibido", "obrigatório", "obrigatorio",
  "desligue", "desenergiz", "pare a máquina", "pare a maquina", "sinalize",
];

/** Palavras que indicam procedimento/passo a passo. */
export const PROCEDURE_MARKERS = [
  "procedimento", "roteiro", "etapa", "passo", "sequência", "sequencia", "primeiro", "depois",
  "em seguida", "por último", "por ultimo", "antes de",
];

/** Pares usados para criar alternativas erradas plausíveis. */
export const ANTONYM_PAIRS: Array<[string, string]> = [
  ["alta", "baixa"], ["alto", "baixo"], ["maior", "menor"], ["acima", "abaixo"], ["aumenta", "reduz"],
  ["aumentar", "reduzir"], ["antes", "depois"], ["sempre", "nunca"], ["deve", "não deve"],
  ["obrigatória", "opcional"], ["obrigatório", "opcional"], ["primeiro", "último"], ["mais", "menos"],
  ["curto", "longo"], ["fina", "grossa"], ["fino", "grosso"], ["excessiva", "insuficiente"],
  ["encolher", "esticar"], ["aparece", "desaparece"], ["permitido", "proibido"], ["reduz", "amplia"],
];

export interface TermHit {
  entry: LexiconEntry;
  occurrences: number;
}

/** Encontra termos do léxico presentes no texto. */
export function findTerms(text: string): TermHit[] {
  const haystack = normalize(text);
  const hits: TermHit[] = [];
  for (const entry of TECHNICAL_LEXICON) {
    const forms = [entry.term, ...(entry.aliases ?? [])];
    let occurrences = 0;
    for (const form of forms) {
      const needle = normalize(form);
      let index = haystack.indexOf(needle);
      while (index !== -1) {
        occurrences += 1;
        index = haystack.indexOf(needle, index + needle.length);
      }
    }
    if (occurrences > 0) hits.push({ entry, occurrences });
  }
  return hits.sort((a, b) => b.occurrences * (b.entry.weight ?? 1) - a.occurrences * (a.entry.weight ?? 1));
}

/** Categoria sugerida pelo peso dos termos encontrados. */
export function suggestCategory(text: string): { category: string; confidence: number; competencies: string[] } {
  const hits = findTerms(text);
  const scores = new Map<string, number>();
  const competencies = new Set<string>();
  let total = 0;
  for (const hit of hits) {
    const score = hit.occurrences * (hit.entry.weight ?? 1);
    scores.set(hit.entry.category, (scores.get(hit.entry.category) ?? 0) + score);
    total += score;
    for (const c of hit.entry.competencies) competencies.add(c);
  }
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (!top || total === 0) return { category: "geral", confidence: 0, competencies: [] };
  // Competências só das categorias dominantes (evita ruído).
  const dominant = new Set(ranked.slice(0, 2).map(([category]) => category));
  const filtered = new Set<string>();
  for (const hit of hits) {
    if (!dominant.has(hit.entry.category)) continue;
    for (const c of hit.entry.competencies) filtered.add(c);
  }
  return { category: top[0], confidence: top[1] / total, competencies: [...filtered] };
}

export function hasMarker(sentence: string, markers: string[]): boolean {
  const s = normalize(sentence);
  return markers.some((m) => s.includes(normalize(m)));
}

/** Cria uma variação errada de uma frase verdadeira (distrator plausível). */
export function mutateStatement(sentence: string): string | null {
  for (const [a, b] of ANTONYM_PAIRS) {
    const rx = new RegExp(`\\b${a}\\b`, "i");
    if (rx.test(sentence)) return sentence.replace(rx, b);
    const rxb = new RegExp(`\\b${b}\\b`, "i");
    if (rxb.test(sentence)) return sentence.replace(rxb, a);
  }
  // Último recurso: troca uma MEDIDA (2,5 mm → 5,0 mm). Só vale quando o
  // número vem seguido de unidade — número de item de lista ("2. Retire…")
  // viraria alternativa sem sentido.
  const measure = /(\d+[,.]?\d*)\s?(mm|cm|m|km|kg|g|%|°|ºC|°C|h|min|s|fios|pontos|graus|vezes)\b/i.exec(sentence);
  if (measure) {
    const value = Number(measure[1].replace(",", "."));
    if (Number.isFinite(value) && value > 0) {
      const changed = value < 10 ? (value * 2).toFixed(1).replace(".", ",") : String(Math.round(value * 1.5));
      return sentence.replace(measure[1], changed);
    }
  }
  return null;
}
