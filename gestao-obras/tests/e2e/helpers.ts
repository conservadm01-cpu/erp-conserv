import { expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { E2E_DATABASE_URL } from "../../playwright.config";

export const DEMO_PASSWORD = "Demo@Obras2026!";
export const db = new PrismaClient({ datasources: { db: { url: E2E_DATABASE_URL } } });

export async function login(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
}

/** Falha o teste se o navegador registrar violação de CSP ou erro de script. */
export function watchConsole(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return { assertClean: () => expect(errors.filter((e) => !e.includes("Failed to load resource"))).toEqual([]) };
}

/** Entra com um usuário que exige MFA, recadastrando o autenticador (o banco E2E é descartável). */
export async function loginWithFreshMfa(page: Page, email: string) {
  const { authenticator } = await import("otplib");
  await db.user.update({ where: { email }, data: { mfaSecretEnc: null, mfaEnabledAt: null, mfaLastUsedStep: null } });
  await db.mfaRecoveryCode.deleteMany({ where: { user: { email } } });
  await login(page, email);
  await expect(page).toHaveURL(/\/mfa\/cadastro$/);
  await page.getByRole("button", { name: "Gerar QR Code" }).click();
  await page.getByText("Não consegue ler o QR Code?").click();
  const secret = (await page.getByTestId("mfa-secret").textContent())!.trim();
  await page.getByLabel("Código de 6 dígitos").fill(authenticator.generate(secret));
  await page.getByRole("button", { name: "Confirmar e ativar" }).click();
  await page.getByRole("button", { name: "Guardei os códigos, continuar" }).click();
  await expect(page.getByRole("heading", { name: "Painel" })).toBeVisible();
}
