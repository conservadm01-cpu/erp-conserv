import { describe, expect, it } from "vitest";
import { answersToPatch, buildQuestions, diaryBodyFrom, periodOf, tripDayOf, visibleQuestions } from "@/lib/media/questions";

const ctx = { trip_start: "2026-12-10", trip_end: "2026-12-15", destination: "El Calafate", itinerary_titles: [] as string[] };
const at = (d: string, h: number) => new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10), h, 15).toISOString();

describe("perguntas contextuais da foto", () => {
  it("identifica período do dia e dia da viagem", () => {
    expect(periodOf(at("2026-12-11", 6))).toBe("amanhecer");
    expect(periodOf(at("2026-12-11", 19))).toBe("golden");
    expect(periodOf(at("2026-12-11", 23))).toBe("noite");
    expect(periodOf(null)).toBeNull();
    expect(tripDayOf(at("2026-12-12", 10), "2026-12-10", "2026-12-15")).toBe(3);
    expect(tripDayOf(at("2026-12-20", 10), "2026-12-10", "2026-12-15")).toBeNull();
  });

  it("usa o dia, o horário e o roteiro do dia", () => {
    const set = buildQuestions({ ...ctx, taken_at: at("2026-12-11", 19), itinerary_titles: ["Glaciar Perito Moreno"] });
    expect(set.heading).toContain("Dia 2");
    const texts = set.questions.map((q) => q.text).join(" | ");
    expect(texts).toMatch(/pôr do sol/);
    expect(texts).toMatch(/Dia 2 da viagem/);
    expect(texts).toMatch(/O que vocês estavam sentindo/);
    expect(texts).toMatch(/Quem aparece na foto/);
    expect(texts).toMatch(/instagramável/);
    expect(set.questions.find((q) => q.id === "lugar")?.options).toContain("Glaciar Perito Moreno");
  });

  it("perguntas de comida só aparecem quando o momento é comida", () => {
    const { questions } = buildQuestions({ ...ctx, taken_at: null });
    expect(visibleQuestions(questions, {}).some((q) => q.id === "prato")).toBe(false);
    const v = visibleQuestions(questions, { tipo: "Comida e bebida" });
    expect(v.some((q) => q.id === "prato")).toBe(true);
    expect(v.some((q) => q.id === "vista")).toBe(false);
  });

  it("converte respostas em legenda, pessoas, etiquetas e instagramável", () => {
    const { questions } = buildQuestions({ ...ctx, taken_at: at("2026-12-11", 13), itinerary_titles: ["Restaurante"] });
    const patch = answersToPatch(
      questions,
      { tipo: "Comida e bebida", legenda: "Cordeiro patagônico!", pessoas: "Ana, Lia", prato: "Cordeiro no Mi Rancho", nota: "5", insta: "Sim", lugar: "Restaurante", sentimento: "" },
      { tags: ["viagem"], people: ["Ana"] },
    );
    expect(patch.caption).toBe("Cordeiro patagônico!");
    expect(patch.people).toEqual(["Ana", "Lia"]);
    expect(patch.instagrammable).toBe(true);
    expect(patch.tags).toEqual(expect.arrayContaining(["viagem", "comida e bebida", "instagramável"]));
    expect(patch.rating).toBe(5);
    expect(patch.place).toBe("Restaurante");
    expect(patch.story_answers.every((a) => a.answer)).toBe(true);
    const body = diaryBodyFrom([{ caption: patch.caption, answers: patch.story_answers }]);
    expect(body).toContain("Cordeiro patagônico!");
    expect(body).toContain("Cordeiro no Mi Rancho");
  });

  it("respostas vazias não alteram a mídia (pular é permitido)", () => {
    const { questions } = buildQuestions({ ...ctx, taken_at: null });
    const patch = answersToPatch(questions, {}, { tags: [], people: [] });
    expect(patch).toEqual({ story_answers: [] });
  });
});
