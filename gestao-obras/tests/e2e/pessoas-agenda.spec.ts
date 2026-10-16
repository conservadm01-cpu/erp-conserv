import { expect, test } from "@playwright/test";
import { db, login, loginWithFreshMfa, watchConsole } from "./helpers";

test.afterAll(async () => db.$disconnect());

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
const nav = (page: import("@playwright/test").Page) => page.getByRole("navigation", { name: "Menu principal" });

test("agenda da unidade, portal do voluntário e ASO restrito", async ({ page }) => {
  test.setTimeout(150_000);
  const console = watchConsole(page);
  const vol = await db.person.findFirstOrThrow({ where: { name: "Voluntário Alfa Demonstração" } });
  const mes = new Date().toISOString().slice(0, 7);

  // 1. Gestor (admin regional) agenda um mutirão na Unidade Local Alfa.
  await loginWithFreshMfa(page, "gestor.norte@exemplo.test");
  await nav(page).getByRole("link", { name: "Agenda" }).click();
  await page.getByRole("button", { name: "Novo compromisso" }).click();
  await page.getByLabel("Unidade local").selectOption({ label: "Unidade Local Alfa" });
  await page.getByLabel("Tipo").selectOption({ label: "Mutirão" });
  await page.getByLabel("Título").fill("Mutirão de pintura do salão");
  await page.getByLabel("Data").fill(`${mes}-28`);
  await page.getByLabel("Início").fill("08:00");
  await page.getByLabel("Término").fill("12:00");
  await page.getByRole("button", { name: "Agendar" }).click();
  await expect(page.getByText("08:00–12:00 · Mutirão de pintura do salão")).toBeVisible();

  // Sem permissão de saúde, o gestor não vê a seção de ASO.
  await page.goto(`/pessoas/${vol.id}`);
  await expect(page.getByRole("heading", { name: "Exigências das atividades" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Saúde ocupacional/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login/);

  // 2. Voluntário entra direto no próprio cadastro, vê o mutirão e envia comprovante e ASO.
  await login(page, "voluntario.alfa@exemplo.test");
  await expect(page.getByRole("heading", { name: "Meu cadastro" })).toBeVisible();
  await expect(page.getByText("Mutirão de pintura do salão")).toBeVisible();
  await expect(nav(page).getByRole("link", { name: "Obras" })).toHaveCount(0);
  await page.getByRole("button", { name: "Enviar comprovante" }).click();
  await page.getByLabel("Tipo").selectOption({ label: "Comprovação de experiência" });
  await page.getByLabel("Nome do comprovante").fill("Declaração de experiência em obras");
  await page.locator("#cred-file").setInputFiles({ name: "declaracao.pdf", mimeType: "application/pdf", buffer: PDF });
  await page.getByRole("button", { name: "Enviar comprovante" }).click();
  await expect(page.getByText("Comprovante enviado. Ele aguarda conferência.")).toBeVisible();
  await page.getByRole("button", { name: "Enviar ASO" }).click();
  await page.getByLabel("Data do exame").fill(new Date().toISOString().slice(0, 10));
  await page.getByLabel("Trabalho em altura").check();
  await page.locator('input[type="file"][id^="aso-file"]').setInputFiles({ name: "aso.pdf", mimeType: "application/pdf", buffer: PDF });
  await page.getByRole("button", { name: "Registrar ASO" }).click();
  await expect(page.getByText("ASO registrado. Ele aguarda conferência.")).toBeVisible();
  // Não acessa cadastros de outras pessoas.
  const other = await db.person.findFirstOrThrow({ where: { name: "Técnico Demonstração Norte" } });
  expect((await page.request.get(`/api/people/${other.id}`)).status()).toBe(404);
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login/);

  // 3. Técnico de segurança confere o ASO enviado.
  await loginWithFreshMfa(page, "seguranca.norte@exemplo.test");
  await page.goto(`/pessoas/${vol.id}`);
  const aso = page.locator("section", { has: page.getByRole("heading", { name: /Saúde ocupacional/ }) });
  // O ASO de demonstração e o enviado agora aguardam conferência.
  await expect(aso.getByText("Aguardando conferência")).toHaveCount(2);
  await aso.getByRole("button", { name: "Conferir" }).first().click();
  await aso.getByRole("button", { name: "Confirmar" }).click();
  await expect(aso.getByText("Aguardando conferência")).toHaveCount(1);
  console.assertClean();
});
