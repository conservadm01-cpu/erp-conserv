import { describe, expect, it } from "vitest";
import { analyzeExperiences } from "@/lib/guide/analyze";

describe("análise de experiências", () => {
  it("detecta interesses com acentos e sugere categorias do guia", () => {
    const a = analyzeExperiences(
      "Queremos ver o Glaciar Perito Moreno, provar o cordeiro patagônico, um bom chocolate quente, conhecer uma igreja e tirar fotos no pôr do sol. Ritmo tranquilo.",
      { children: 1 },
    );
    const keys = a.interests.map((i) => i.key);
    expect(keys).toEqual(expect.arrayContaining(["natureza", "culinaria_local", "cafes", "religioso", "fotografia", "familia"]));
    expect(a.place_categories).toEqual(expect.arrayContaining(["religioso", "mirante", "cafe"]));
    expect(a.pace.suggested).toBe("tranquilo");
    expect(a.label).toMatch(/por regras/);
  });

  it("não confunde barco com bar nem feira com fé", () => {
    const a = analyzeExperiences("passeio de barco e visita à feira");
    const keys = a.interests.map((i) => i.key);
    expect(keys).not.toContain("bares");
    expect(keys).not.toContain("religioso");
    expect(keys).toContain("aventura");
  });

  it("texto vazio gera pergunta inicial", () => {
    const a = analyzeExperiences("");
    expect(a.empty).toBe(true);
    expect(a.questions[0]).toMatch(/Conte/);
  });

  it("detecta ritmo intenso", () => {
    expect(analyzeExperiences("quero aproveitar tudo ao máximo, bares à noite").pace.suggested).toBe("intenso");
  });
});
