import type { PlaceCategory } from "@/lib/providers/types";

export const ANALYSIS_LABEL = "Análise automática por regras (palavras-chave) — não usa inteligência artificial nem dados pessoais externos.";

export type InterestKey =
  | "gastronomia"
  | "bares"
  | "cafes"
  | "culinaria_local"
  | "religioso"
  | "natureza"
  | "aventura"
  | "familia"
  | "fotografia"
  | "cultura"
  | "compras"
  | "relax"
  | "acessibilidade";

interface InterestDef {
  label: string;
  keywords: string[];
  places: PlaceCategory[];
  tips: string[];
}

export const INTERESTS: Record<InterestKey, InterestDef> = {
  gastronomia: {
    label: "Gastronomia",
    keywords: ["restaurante", "comer", "comida", "jantar", "almoco", "gastronom", "chef", "degustac", "prato", "provar", "sabor"],
    places: ["restaurante", "culinaria"],
    tips: ["Reserve com antecedência os restaurantes mais procurados, sobretudo para jantar.", "Pergunte pelo prato típico da casa e pelo menu do dia."],
  },
  bares: {
    label: "Bares e vida noturna",
    keywords: ["bar=", "bares", "cerveja", "drink", "vinho", "balada", "noite", "pub=", "happy hour", "coquetel", "vinicola"],
    places: ["bar"],
    tips: ["Verifique horários: em muitos destinos os bares só enchem depois das 22h.", "Planeje transporte de volta se for beber — não dirija."],
  },
  cafes: {
    label: "Cafés e doces",
    keywords: ["cafe", "cafeteria", "chocolate", "doce", "confeitaria", "padaria", "sorvete", "torta", "lanche da tarde", "cha="],
    places: ["cafe"],
    tips: ["Cafés e chocolaterias são ótimos para pausas em dias frios ou chuvosos."],
  },
  culinaria_local: {
    label: "Culinária local",
    keywords: ["tipic", "local=", "regional", "tradicional", "cordeiro", "asado", "parrilla", "empanada", "mercado", "feira", "artesanal", "culinaria"],
    places: ["culinaria", "restaurante"],
    tips: ["Mercados e feiras locais mostram ingredientes da região.", "Pergunte aos moradores onde eles comem — costuma ser mais autêntico."],
  },
  religioso: {
    label: "Locais religiosos",
    keywords: ["igreja", "capela", "catedral", "santuario", "templo", "missa", "religi", "oracao", "mosteiro", "basilica", "espiritual", "sinagoga", "mesquita"],
    places: ["religioso"],
    tips: ["Confira horários de celebrações e se há restrições de visita durante cultos.", "Use roupas adequadas e peça permissão antes de fotografar o interior."],
  },
  natureza: {
    label: "Natureza",
    keywords: ["natureza", "glaciar", "geleira", "lago", "montanha", "parque", "praia", "cachoeira", "paisagem", "fauna", "aves", "floresta", "neve", "iceberg"],
    places: ["parque", "mirante"],
    tips: ["Leve camadas de roupa: o tempo muda rápido em áreas naturais.", "Confira taxas de entrada de parques — atrações gratuitas ainda podem exigir transporte."],
  },
  aventura: {
    label: "Aventura",
    keywords: ["trilha", "trekking", "caminhada", "escalada", "rafting", "caiaque", "aventura", "radical", "mountain bike", "cavalgada", "navegar", "navegacao", "barco"],
    places: ["parque", "atracao"],
    tips: ["Verifique idade mínima e condicionamento exigido.", "Contrate seguro viagem que cubra atividades de aventura."],
  },
  familia: {
    label: "Família e crianças",
    keywords: ["crianca", "filho", "filha", "familia", "infantil", "kids", "bebe", "netos"],
    places: ["parque", "museu", "atracao"],
    tips: ["Prefira atividades curtas e intercale com pausas.", "Confirme idade mínima e preço infantil antes de reservar."],
  },
  fotografia: {
    label: "Fotografia e lugares instagramáveis",
    keywords: ["foto", "fotograf", "instagram", "por do sol", "nascer do sol", "vista=", "mirante", "panoram", "selfie", "cenario"],
    places: ["mirante", "atracao"],
    tips: ["A luz dourada acontece logo após o nascer e antes do pôr do sol.", "Chegue cedo aos pontos famosos para fotos sem multidão."],
  },
  cultura: {
    label: "Cultura e museus",
    keywords: ["museu", "historia", "arte", "cultura", "galeria", "arquitetura", "patrimonio", "centro historico", "show=", "teatro"],
    places: ["museu", "atracao"],
    tips: ["Muitos museus fecham um dia por semana — confira antes."],
  },
  compras: {
    label: "Compras",
    keywords: ["compra", "shopping", "loja", "artesanato", "lembranca", "souvenir", "outlet"],
    places: ["atracao"],
    tips: ["Separe um valor de compras no orçamento para não estourar a categoria."],
  },
  relax: {
    label: "Descanso",
    keywords: ["relax", "descans", "tranquil", "calma", "spa", "sem pressa", "devagar", "sossego"],
    places: ["cafe", "parque"],
    tips: ["Deixe ao menos um período livre por dia."],
  },
  acessibilidade: {
    label: "Acessibilidade",
    keywords: ["cadeira de rodas", "cadeirante", "acessivel", "acessibilidade", "mobilidade reduzida", "idoso", "carrinho de bebe"],
    places: [],
    tips: ["Os dados do mapa indicam acessibilidade quando colaboradores informaram (campo 'wheelchair') — confirme com o local."],
  },
};

export function normalizeText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export interface InterestHit {
  key: InterestKey;
  label: string;
  score: number;
  matched: string[];
  places: PlaceCategory[];
  tips: string[];
}

export interface ExperienceAnalysis {
  label: string;
  empty: boolean;
  interests: InterestHit[];
  pace: { suggested: "tranquilo" | "moderado" | "intenso"; reason: string };
  place_categories: PlaceCategory[];
  questions: string[];
  highlights: string[];
}

function countMatches(text: string, kw: string): number {
  // "palavra=" exige palavra inteira; sem "=", vale como prefixo ("fotograf" casa com "fotografia")
  const exact = kw.endsWith("=");
  const k = normalizeText(exact ? kw.slice(0, -1) : kw).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^a-z0-9])${k}${exact ? "(?![a-z0-9])" : ""}`, "g");
  return (text.match(re) ?? []).length;
}

/** Analisa o texto livre de experiências desejadas e sugere interesses, ritmo, buscas e perguntas. */
export function analyzeExperiences(input: string, ctx: { children?: number; pace?: string } = {}): ExperienceAnalysis {
  const text = normalizeText(input ?? "");
  const empty = text.trim().length < 3;
  const interests: InterestHit[] = [];
  for (const [key, def] of Object.entries(INTERESTS) as [InterestKey, InterestDef][]) {
    const matched: string[] = [];
    let score = 0;
    for (const kw of def.keywords) {
      const n = countMatches(text, kw);
      if (n) {
        matched.push(kw.replace(/=$/, ""));
        score += n;
      }
    }
    if (key === "familia" && (ctx.children ?? 0) > 0) {
      score += 1;
      matched.push("(viagem com crianças)");
    }
    if (score > 0) interests.push({ key, label: def.label, score, matched, places: def.places, tips: def.tips });
  }
  interests.sort((a, b) => b.score - a.score);

  const has = (k: InterestKey) => interests.some((i) => i.key === k);
  const calm = countMatches(text, "tranquil") + countMatches(text, "devagar") + countMatches(text, "sem pressa") + countMatches(text, "descans");
  const intense = countMatches(text, "aproveitar tudo") + countMatches(text, "maximo") + countMatches(text, "intens") + countMatches(text, "corrid");
  let suggested: ExperienceAnalysis["pace"]["suggested"] = "moderado";
  let reason = "Equilíbrio entre passeios e tempo livre.";
  if (calm > intense || has("relax") || ((ctx.children ?? 0) > 0 && !intense)) {
    suggested = "tranquilo";
    reason = calm || has("relax") ? "O texto pede calma/descanso." : "Viagem com crianças: menos deslocamentos por dia.";
  } else if (intense > 0) {
    suggested = "intenso";
    reason = "O texto indica vontade de aproveitar o máximo de atividades.";
  }

  const place_categories = [...new Set(interests.flatMap((i) => i.places))];
  const questions: string[] = [];
  if (empty) questions.push("Conte o que faria esta viagem inesquecível: comidas, lugares, sensações, pessoas.");
  if (has("gastronomia") || has("culinaria_local")) questions.push("Há restrições alimentares ou pratos que vocês não comem?");
  if (has("bares")) questions.push("Preferem bares tranquilos para conversar ou lugares com música ao vivo?");
  if (has("religioso")) questions.push("Gostariam de participar de alguma celebração ou só visitar a arquitetura?");
  if (has("aventura") || has("natureza")) questions.push("Qual o nível de esforço físico confortável para todos (leve, moderado, intenso)?");
  if (has("familia")) questions.push("Quais horários de sono/refeição das crianças devemos respeitar no roteiro?");
  if (has("fotografia")) questions.push("Querem priorizar nascer ou pôr do sol para as fotos?");
  if (!has("acessibilidade")) questions.push("Alguém precisa de acessibilidade (mobilidade, visão, audição)?");
  if (!questions.some((q) => q.includes("orçamento"))) questions.push("Qual experiência vale gastar mais e qual pode ser econômica?");

  const highlights = interests.slice(0, 3).map((i) => `${i.label}: ${i.tips[0]}`);

  return { label: ANALYSIS_LABEL, empty, interests, pace: { suggested, reason }, place_categories, questions: questions.slice(0, 6), highlights };
}
