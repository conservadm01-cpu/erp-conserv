import { describe, expect, it } from "vitest";
import { containsCardNumber, containsPassword, sensitiveDataError } from "@/lib/reservations/sensitive";

describe("dados sensíveis", () => {
  it("detecta número de cartão válido (Luhn) com ou sem separadores", () => {
    expect(containsCardNumber("cartão 4111 1111 1111 1111 vence 12/28")).toBe(true);
    expect(containsCardNumber("5500-0000-0000-0004")).toBe(true);
  });
  it("não confunde códigos de reserva, telefones e finais de cartão", () => {
    expect(containsCardNumber("Confirmação ABC123456")).toBe(false);
    expect(containsCardNumber("final 1111")).toBe(false);
    expect(containsCardNumber("+54 2902 491 234")).toBe(false);
    expect(containsCardNumber("1234567890123")).toBe(false);
  });
  it("detecta senhas e CVV", () => {
    expect(containsPassword("senha: abc12345")).toBe(true);
    expect(containsPassword("CVV 123")).toBe(true);
    expect(containsPassword("Política de cancelamento gratuita")).toBe(false);
    expect(sensitiveDataError("ok", "4111111111111111")).toMatch(/cartão/);
    expect(sensitiveDataError("ok")).toBeNull();
  });
});
