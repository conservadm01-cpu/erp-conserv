import { authenticator } from "otplib";
import QRCode from "qrcode";
import { randomBytes } from "node:crypto";
import { sha256Hex } from "../crypto";

const STEP_SECONDS = 30;
authenticator.options = { step: STEP_SECONDS, window: 1, digits: 6 };

export const MFA_ISSUER = "Gestão de Obras";

export function generateMfaSecret(): string {
  return authenticator.generateSecret(20);
}

export async function mfaEnrollmentData(email: string, secret: string) {
  const otpauthUrl = authenticator.keyuri(email, MFA_ISSUER, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 220 });
  return { otpauthUrl, qrDataUrl };
}

/**
 * Valida um código TOTP e devolve o passo de tempo usado, para impedir
 * reutilização do mesmo código. Retorna null se inválido ou repetido.
 */
export function verifyTotp(secret: string, code: string, lastUsedStep: bigint | null, now = Date.now()): bigint | null {
  if (!/^\d{6}$/.test(code)) return null;
  const delta = authenticator.checkDelta(code, secret);
  if (delta === null) return null;
  const step = BigInt(Math.floor(now / 1000 / STEP_SECONDS) + delta);
  if (lastUsedStep !== null && step <= lastUsedStep) return null;
  return step;
}

const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeRecoveryCode(code: string) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Gera códigos de recuperação de uso único (formato XXXXX-XXXXX). */
export function generateRecoveryCodes(count = 8): { plain: string[]; hashes: string[] } {
  const plain: string[] = [];
  for (let i = 0; i < count; i++) {
    const bytes = randomBytes(10);
    const chars = [...bytes].map((b) => RECOVERY_ALPHABET[b % RECOVERY_ALPHABET.length]).join("");
    plain.push(`${chars.slice(0, 5)}-${chars.slice(5)}`);
  }
  return { plain, hashes: plain.map((c) => sha256Hex(normalizeRecoveryCode(c))) };
}
