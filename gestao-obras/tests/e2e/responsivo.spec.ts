import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("menu funciona em tela de celular", async ({ page }) => {
  await login(page, "consulta.alfa@exemplo.test");
  await expect(page.getByRole("heading", { name: "Painel" })).toBeVisible();
  const toggle = page.getByRole("button", { name: "Abrir menu" });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await page.locator("#menu-movel").getByRole("link", { name: "Estrutura organizacional" }).click();
  await expect(page.getByRole("heading", { name: "Estrutura organizacional" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
