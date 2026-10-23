// Gerador de perguntas contextuais exibidas quando o usuário envia fotos.
// Função pura: recebe o contexto da foto/viagem e devolve as perguntas.

import type { ItineraryItem, MediaAsset, StoryAnswer } from "@/lib/types";

export type QuestionKind = "text" | "people" | "yesno" | "choice" | "rating";
export type QuestionField = "caption" | "people" | "instagrammable" | "tags" | "place" | "rating" | "story";

export interface Question {
  id: string;
  text: string;
  kind: QuestionKind;
  field: QuestionField;
  options?: string[];
  placeholder?: string;
  /** Só aparece se a pergunta `id` tiver a resposta `equals`. */
  when?: { id: string; equals: string };
}

export type Period = "madrugada" | "amanhecer" | "manha" | "almoco" | "tarde" | "golden" | "noite";

export interface PhotoContext {
  taken_at: string | null;
  trip_start: string; // YYYY-MM-DD
  trip_end: string;
  destination: string;
  itinerary_titles: string[]; // itens do roteiro do dia da foto
}

export const MOMENT_TYPES = ["Paisagem", "Comida e bebida", "Pessoas", "Cultura ou religião", "Aventura", "Outro"];

export function periodOf(iso: string | null): Period | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const h = d.getHours();
  if (h < 5) return "madrugada";
  if (h < 7) return "amanhecer";
  if (h < 11) return "manha";
  if (h < 14) return "almoco";
  if (h < 17) return "tarde";
  if (h < 21) return "golden";
  return "noite";
}

function localDate(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Dia da viagem (1 = primeiro dia) ou null se a foto é de fora do período. */
export function tripDayOf(iso: string | null, start: string, end: string): number | null {
  if (!iso) return null;
  const day = localDate(iso);
  if (day < start || day > end) return null;
  const a = Date.UTC(+start.slice(0, 4), +start.slice(5, 7) - 1, +start.slice(8, 10));
  const b = Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
  return Math.round((b - a) / 86_400_000) + 1;
}

export function photoDate(asset: Pick<MediaAsset, "taken_at" | "created_at">): string {
  return localDate(asset.taken_at ?? asset.created_at);
}

const PERIOD_Q: Record<Period, string> = {
  madrugada: "Madrugada acordados! O que fez vocês estarem de pé a essa hora?",
  amanhecer: "Foto ao amanhecer: como estava a luz e o clima quando o dia começou?",
  manha: "Como começou este dia? Qual era o plano da manhã?",
  almoco: "Hora do almoço: onde vocês estavam e o que comeram?",
  tarde: "O que estava acontecendo nesta tarde?",
  golden: "Essa é a luz dourada do fim de tarde. Como foi o pôr do sol daqui?",
  noite: "Como terminou a noite? Algum lugar ou sabor marcante?",
};

export interface QuestionSet {
  day: number | null;
  period: Period | null;
  heading: string;
  questions: Question[];
}

export function buildQuestions(ctx: PhotoContext): QuestionSet {
  const day = tripDayOf(ctx.taken_at, ctx.trip_start, ctx.trip_end);
  const period = periodOf(ctx.taken_at);
  const q: Question[] = [];
  q.push({ id: "tipo", text: "Que tipo de momento é este?", kind: "choice", field: "tags", options: MOMENT_TYPES });
  if (ctx.itinerary_titles.length) {
    q.push({ id: "lugar", text: "Esta foto é de qual parada do roteiro?", kind: "choice", field: "place", options: [...ctx.itinerary_titles.slice(0, 8), "Outro lugar"] });
  } else {
    q.push({ id: "lugar", text: `Onde em ${ctx.destination || "sua viagem"} vocês estavam?`, kind: "text", field: "place", placeholder: "Ex.: Mirante do lago" });
  }
  q.push({ id: "legenda", text: "Em uma frase, o que este momento significa para vocês?", kind: "text", field: "caption", placeholder: "Vira a legenda da foto" });
  q.push({ id: "sentimento", text: "O que vocês estavam sentindo neste momento?", kind: "text", field: "story" });
  q.push({ id: "pessoas", text: "Quem aparece na foto?", kind: "people", field: "people", placeholder: "Nomes separados por vírgula" });
  q.push({ id: "prato", text: "Qual sabor, prato ou bebida era esse, e onde foi?", kind: "text", field: "story", when: { id: "tipo", equals: "Comida e bebida" } });
  q.push({ id: "nota", text: "Que nota vocês dão para essa experiência?", kind: "rating", field: "rating", when: { id: "tipo", equals: "Comida e bebida" } });
  q.push({ id: "vista", text: "O que mais impressionou nessa paisagem?", kind: "text", field: "story", when: { id: "tipo", equals: "Paisagem" } });
  q.push({ id: "fe", text: "Que lugar é esse e o que sentiram ao visitá-lo?", kind: "text", field: "story", when: { id: "tipo", equals: "Cultura ou religião" } });
  q.push({ id: "aventura", text: "Qual foi o desafio ou a emoção dessa aventura?", kind: "text", field: "story", when: { id: "tipo", equals: "Aventura" } });
  q.push({ id: "historia", text: "Tem alguma história engraçada ou curiosa por trás desta foto?", kind: "text", field: "story", when: { id: "tipo", equals: "Pessoas" } });
  if (period) q.push({ id: "periodo", text: PERIOD_Q[period], kind: "text", field: "story" });
  if (day) q.push({ id: "dia", text: `Dia ${day} da viagem: qual foi o ponto alto do dia até aqui?`, kind: "text", field: "story" });
  q.push({ id: "insta", text: "Este lugar é instagramável? Merece destaque no book da viagem?", kind: "yesno", field: "instagrammable" });
  const heading = day ? `Dia ${day}${period ? ` · ${labelPeriod(period)}` : ""}` : period ? labelPeriod(period) : "Seu momento";
  return { day, period, heading, questions: q };
}

export function labelPeriod(p: Period): string {
  return { madrugada: "madrugada", amanhecer: "amanhecer", manha: "manhã", almoco: "almoço", tarde: "tarde", golden: "fim de tarde (golden hour)", noite: "noite" }[p];
}

/** Perguntas visíveis dado o conjunto atual de respostas. */
export function visibleQuestions(qs: Question[], answers: Record<string, string>): Question[] {
  return qs.filter((q) => !q.when || answers[q.when.id] === q.when.equals);
}

export interface AnswerPatch {
  caption?: string;
  people?: string[];
  tags?: string[];
  instagrammable?: boolean;
  story_answers: StoryAnswer[];
  place?: string;
  rating?: number;
}

/** Converte respostas em alterações na mídia. Ignora respostas vazias. */
export function answersToPatch(qs: Question[], answers: Record<string, string>, current: Pick<MediaAsset, "tags" | "people">): AnswerPatch {
  const patch: AnswerPatch = { story_answers: [] };
  const tags = new Set(current.tags);
  for (const q of visibleQuestions(qs, answers)) {
    const a = (answers[q.id] ?? "").trim();
    if (!a) continue;
    patch.story_answers.push({ question: q.text, answer: a });
    switch (q.field) {
      case "caption":
        patch.caption = a;
        break;
      case "people":
        patch.people = [...new Set([...current.people, ...a.split(/[,;]/).map((s) => s.trim()).filter(Boolean)])];
        break;
      case "instagrammable":
        patch.instagrammable = a === "Sim";
        if (a === "Sim") tags.add("instagramável");
        break;
      case "tags":
        tags.add(a.toLowerCase());
        break;
      case "place":
        if (a !== "Outro lugar") patch.place = a;
        break;
      case "rating": {
        const n = Number(a);
        if (n >= 1 && n <= 5) patch.rating = n;
        break;
      }
    }
  }
  if (tags.size !== current.tags.length || [...tags].some((t) => !current.tags.includes(t))) patch.tags = [...tags];
  return patch;
}

/** Texto do diário a partir das respostas de uma ou mais fotos. */
export function diaryBodyFrom(items: { caption?: string; answers: StoryAnswer[] }[]): string {
  return items
    .map((it) => {
      const head = it.caption ? `📷 ${it.caption}` : "📷 Momento registrado";
      const lines = it.answers.filter((a) => a.answer && !/legenda|significa/i.test(a.question)).map((a) => `• ${a.question}\n  ${a.answer}`);
      return [head, ...lines].join("\n");
    })
    .join("\n\n");
}

export function itineraryTitlesForDate(items: ItineraryItem[], dayIdForDate: string | null): string[] {
  if (!dayIdForDate) return [];
  return items
    .filter((i) => i.day_id === dayIdForDate)
    .sort((a, b) => a.position - b.position)
    .map((i) => i.title);
}
