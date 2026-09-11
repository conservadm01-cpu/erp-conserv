// =====================================================================
// Ferramentas de texto (PT-BR) usadas pelo CONTENT_ENGINE.
// Tudo aqui é determinístico e roda no navegador: é o "analisador local"
// que garante que a plataforma funcione mesmo sem nenhuma API de IA
// conectada. Quando uma API for ligada (engines/content/ai), ela passa a
// enriquecer esses resultados — não a substituir a rastreabilidade.
// =====================================================================

export const STOPWORDS_PT = new Set([
  "a","ao","aos","aquela","aquelas","aquele","aqueles","aquilo","as","até","com","como","da","das","de","dela","delas",
  "dele","deles","depois","do","dos","e","ela","elas","ele","eles","em","entre","era","eram","essa","essas","esse",
  "esses","esta","estas","este","estes","eu","foi","foram","há","isso","isto","já","lhe","lhes","mais","mas","me",
  "mesmo","meu","minha","muito","na","não","nas","nem","no","nos","nossa","nosso","num","numa","o","os","ou","para",
  "pela","pelas","pelo","pelos","por","qual","quando","que","quem","se","sem","ser","seu","sua","suas","seus","só",
  "também","te","tem","têm","tendo","ter","teu","tua","um","uma","umas","uns","você","vocês","à","às","aí","ainda",
  "onde","cada","toda","todo","todas","todos","pode","podem","deve","devem","sobre","após","antes","então","assim",
  "ele","isso","desta","deste","dessa","desse","pelo","além","bem","está","estão","seja","sejam","sido","outra",
  "outro","outras","outros","qualquer","muita","muitos","muitas","quanto","mesma","vez","vezes","fim","caso","etc",
]);

/** Remove acentos e baixa a caixa — usado em comparações e buscas. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function slugify(text: string): string {
  return normalize(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Limpa ruído típico de PDF: hifenização de fim de linha, espaços duplos. */
export function cleanExtractedText(raw: string): string {
  return raw
    .replace(/\r/g, "\n")
    .replace(/([a-záéíóúâêôãõç])-\n([a-záéíóúâêôãõç])/gi, "$1$2")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\u00a0/g, " ")
    .trim();
}

const ABBREVIATIONS = ["sr", "sra", "dr", "dra", "art", "nr", "fig", "ex", "pág", "nº", "no", "etc", "min", "max"];

/** Separa em frases respeitando abreviações e numerações comuns. */
export function splitSentences(text: string): string[] {
  const parts: string[] = [];
  let buffer = "";
  const chars = text.replace(/\n+/g, " ").split("");
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    buffer += ch;
    if (ch === "." || ch === "!" || ch === "?" || ch === ";") {
      const tail = normalize(buffer.trim().split(/\s+/).pop() ?? "").replace(/[.!?;]/g, "");
      const next = chars[i + 1];
      const isAbbrev = ABBREVIATIONS.includes(tail) || /^\d+$/.test(tail);
      const nextIsSpaceAndUpper = next === undefined || (next === " " && /[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9•\-]/.test(chars[i + 2] ?? ""));
      if (!isAbbrev && nextIsSpaceAndUpper) {
        parts.push(buffer.trim());
        buffer = "";
      }
    }
  }
  if (buffer.trim()) parts.push(buffer.trim());
  return parts.map((s) => s.trim()).filter((s) => s.length > 2);
}

export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter((p) => p.length > 0);
}

export function tokenize(text: string): string[] {
  return normalize(text)
    .replace(/[^a-z0-9çãáéíóúâêôõ\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS_PT.has(t) && !/^\d+$/.test(t));
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Frequência de termos (unigramas + bigramas relevantes). */
export function termFrequency(text: string): Map<string, number> {
  const tokens = tokenize(text);
  const freq = new Map<string, number>();
  for (const t of tokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  for (let i = 0; i < tokens.length - 1; i += 1) {
    const bigram = `${tokens[i]} ${tokens[i + 1]}`;
    freq.set(bigram, (freq.get(bigram) ?? 0) + 1);
  }
  return freq;
}

export function topTerms(text: string, limit = 12): Array<{ term: string; count: number }> {
  const freq = termFrequency(text);
  return [...freq.entries()]
    .filter(([term, count]) => count > 1 || term.includes(" ") === false)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term, count]) => ({ term, count }));
}

/** Similaridade de Jaccard — usada para evitar questões/aulas duplicadas. */
export function similarity(a: string, b: string): number {
  const sa = new Set(tokenize(a));
  const sb = new Set(tokenize(b));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  return inter / (sa.size + sb.size - inter);
}

export function truncate(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).replace(/[\s,;:.]+$/, "")}…`;
}

export function capitalize(text: string): string {
  if (!text) return text;
  return text[0].toUpperCase() + text.slice(1);
}

export function titleCaseTerm(term: string): string {
  return term
    .split(" ")
    .map((w) => (w.length > 3 ? capitalize(w) : w))
    .join(" ");
}

/**
 * Padrões de definição em português técnico:
 *   "A tensão é a força aplicada..."   "Diferencial: mecanismo que..."
 *   "Chamamos de enfesto o processo..."  "...significa que..."
 */
const DEFINITION_PATTERNS: RegExp[] = [
  /^(?:o|a|os|as)?\s*([A-Za-zÀ-ÿ][\wÀ-ÿ\s-]{2,48}?)\s+(?:é|são)\s+(?:o|a|um|uma|os|as)?\s*(.{16,300})$/i,
  /^([A-Za-zÀ-ÿ][\wÀ-ÿ\s-]{2,48}?)\s*[:–-]\s*(.{16,300})$/,
  /^(?:chamamos de|denomina-se|define-se)\s+([\wÀ-ÿ\s-]{2,48}?)\s+(.{16,300})$/i,
  /^(?:o|a)\s+([\wÀ-ÿ\s-]{2,48}?)\s+(?:consiste em|serve para|significa)\s+(.{16,300})$/i,
];

export function extractDefinition(sentence: string): { term: string; text: string } | null {
  const clean = sentence.replace(/^[\s•\-–*]+/, "").trim();
  for (const pattern of DEFINITION_PATTERNS) {
    const m = pattern.exec(clean);
    if (!m) continue;
    const term = m[1].trim().replace(/\s{2,}/g, " ");
    const text = m[2].trim();
    if (term.split(/\s+/).length > 6) continue;
    if (STOPWORDS_PT.has(normalize(term))) continue;
    if (text.length < 16) continue;
    return { term, text: capitalize(text) };
  }
  return null;
}

/** Detecta listas de passos: "1. ..." "1) ..." "- ..." "• ..." */
export function extractStepLists(text: string): string[][] {
  const lines = text.split(/\n/).map((l) => l.trim());
  const groups: string[][] = [];
  let current: string[] = [];
  const isStep = (line: string) => /^(\d{1,2}[.)\-]|[•\-*–])\s+\S/.test(line);
  for (const line of lines) {
    if (isStep(line)) {
      current.push(line.replace(/^(\d{1,2}[.)\-]|[•\-*–])\s+/, "").trim());
    } else if (current.length > 0) {
      if (current.length >= 3) groups.push(current);
      current = [];
    }
  }
  if (current.length >= 3) groups.push(current);
  return groups;
}

export function readingMinutes(text: string): number {
  return Math.max(1, Math.round(wordCount(text) / 180));
}

/** Remove a primeira palavra/numeração de um item de lista. */
export function stripBullet(line: string): string {
  return line.replace(/^(\d{1,2}[.)\-]|[•\-*–])\s*/, "").trim();
}

export function highlight(text: string, terms: string[]): string {
  return terms.reduce((acc, term) => acc.replace(new RegExp(`(${term})`, "gi"), "«$1»"), text);
}
