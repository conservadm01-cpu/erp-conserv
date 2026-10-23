import { describe, expect, it } from "vitest";
import { goldenHours, hhmm, sunTimes } from "@/lib/guide/sun";

describe("nascer e pôr do sol", () => {
  it("El Calafate em dezembro tem dias longos (verão austral)", () => {
    const t = sunTimes("2026-12-12", -50.3379, -72.2648)!;
    // Conferência trigonométrica: declinação −23,1° a 50,3°S → ~16h21 de sol; meio-dia solar ≈ 13h42 (UTC−3)
    expect(hhmm(t.sunrise, "America/Argentina/Rio_Gallegos")).toMatch(/^05:[2-4]\d$/);
    expect(hhmm(t.sunset, "America/Argentina/Rio_Gallegos")).toMatch(/^2(1:[4-5]\d|2:0\d)$/);
    const hours = (t.sunset.getTime() - t.sunrise.getTime()) / 3_600_000;
    expect(hours).toBeGreaterThan(16);
    expect(hours).toBeLessThan(16.7);
  });

  it("São Paulo em dezembro", () => {
    const t = sunTimes("2026-12-12", -23.55, -46.63)!;
    expect(hhmm(t.sunrise, "America/Sao_Paulo")).toMatch(/^05:1\d$/);
    expect(hhmm(t.sunset, "America/Sao_Paulo")).toMatch(/^18:[4-5]\d$/);
  });

  it("Equador tem ~12h de sol", () => {
    const t = sunTimes("2026-03-20", 0, 0)!;
    expect((t.sunset.getTime() - t.sunrise.getTime()) / 3_600_000).toBeCloseTo(12.1, 0);
  });

  it("sol da meia-noite retorna null", () => {
    expect(sunTimes("2026-06-21", 78.2, 15.6)).toBeNull();
  });

  it("horário dourado é 1h após nascer e 1h antes do pôr", () => {
    const g = goldenHours("2026-12-12", -50.34, -72.26)!;
    expect(g.morningEnd.getTime() - g.sunrise.getTime()).toBe(3_600_000);
    expect(g.sunset.getTime() - g.eveningStart.getTime()).toBe(3_600_000);
  });
});
