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
