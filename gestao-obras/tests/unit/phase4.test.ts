import { describe, expect, it } from "vitest";
import { tiersSchema } from "@/server/validation/phase4";

describe("validação de alçadas por valor", () => {
  it("mantém a faixa sem limite superior como nula (não converte para zero)", () => {
    const { tiers } = tiersSchema.parse({ tiers: [{ upToAmount: "5000", stepsRequired: "1" }, { upToAmount: null, stepsRequired: 2 }] });
    expect(tiers).toEqual([{ upToAmount: 5000, stepsRequired: 1 }, { upToAmount: null, stepsRequired: 2 }]);
  });

  it("recusa valores negativos e quantidade de decisões fora do limite", () => {
    expect(tiersSchema.safeParse({ tiers: [{ upToAmount: -1, stepsRequired: 1 }] }).success).toBe(false);
    expect(tiersSchema.safeParse({ tiers: [{ upToAmount: null, stepsRequired: 6 }] }).success).toBe(false);
  });
});
