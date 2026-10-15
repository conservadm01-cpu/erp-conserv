import { expect, test } from "@playwright/test";
import { db, loginWithFreshMfa, watchConsole } from "./helpers";

test.afterAll(async () => db.$disconnect());

test("segurança: inspeção com não conformidade crítica, ação corretiva com segregação, alerta e EPI", async ({ page }) => {
  test.setTimeout(120_000);
  const console = watchConsole(page);
  // Preparação direta no banco E2E: obra aprovada na Unidade Local Alfa e uma pessoa.
  const alfa = await db.organizationUnit.findUniqueOrThrow({ where: { code: "UL-ALFA" } });
  const creator = await db.user.findUniqueOrThrow({ where: { email: "gestor.norte@exemplo.test" } });
  const work = await db.work.create({
    data: { code: "OB-E2E-00001", title: "Obra para inspeção", unitId: alfa.id, unitPath: alfa.path, typeCode: "REFORMA", status: "APROVADA", scope: "Escopo.", justification: "Justificativa.", createdById: creator.id },
  });
  await db.person.create({ data: { name: "Voluntário E2E", category: "VOLUNTARIO", unitId: alfa.id, unitPath: alfa.path, createdById: creator.id } });

  await loginWithFreshMfa(page, "seguranca.norte@exemplo.test");

  // 1. Planeja e realiza a inspeção pelo checklist.
  await page.goto(`/obras/${work.id}?aba=seguranca`);
  await page.getByRole("button", { name: "Planejar inspeção" }).click();
  await page.getByLabel("Checklist").selectOption({ label: "Inspeção geral de canteiro (exemplo)" });
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("heading", { name: "Inspeção de segurança" })).toBeVisible();
  const items = page.locator("ol > li");
  await expect(items).toHaveCount(8);
  await items.nth(0).getByText("Não conforme").click();
  await items.nth(0).getByLabel("Criticidade").selectOption({ label: "Crítica" });
  await items.nth(0).getByLabel("Observação").fill("Escada sem travamento.");
  for (let i = 1; i < 8; i++) await items.nth(i).getByText("Conforme", { exact: true }).click();
  await page.getByLabel("Conclusão da inspeção").fill("Uma não conformidade crítica identificada.");
  await page.getByRole("button", { name: "Concluir inspeção" }).click();
  await expect(page.getByText(/1 ação\(ões\) corretiva\(s\) criada\(s\)/)).toBeVisible();

  // Relatório da inspeção em PDF.
  const pdf = page.waitForEvent("download");
  await page.getByRole("link", { name: "Relatório (PDF)" }).click();
  expect((await pdf).suggestedFilename()).toMatch(/^inspecao-OB-E2E-00001-/);

  // 2. Ação corretiva: bloqueio informado, tratamento e segregação na validação.
  await page.getByRole("link", { name: /Corrigir: / }).click();
  await expect(page.getByText(/a obra não pode iniciar, retomar a execução/)).toBeVisible();
  await page.getByRole("button", { name: "Iniciar tratamento" }).click();
  await page.getByLabel("Evidência da correção").fill("Escada substituída por modelo com travamento.");
  await page.getByRole("button", { name: "Enviar para validação" }).click();
  await expect(page.getByText("Aguardando validação").first()).toBeVisible();
  await expect(page.getByText("Por segregação de funções, a validação deve ser feita por outra pessoa.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Validar e encerrar" })).toHaveCount(0);

  // 3. Alerta crítico chegou às notificações.
  await page.getByRole("link", { name: /Notificações \(\d+ não lidas\)/ }).click();
  await expect(page.getByText(/Risco crítica — obra OB-E2E-00001/)).toBeVisible();

  // 4. EPI: entrada no estoque e entrega individual.
  await page.goto("/epis");
  await page.getByRole("button", { name: "Registrar entrada, baixa ou ajuste" }).click();
  await page.getByLabel("EPI").selectOption({ label: "Capacete de segurança (exemplo)" });
  await page.getByLabel("Local de estoque").selectOption({ label: "— — Unidade Local Alfa" });
  await page.getByLabel("Tipo").selectOption({ label: "Entrada" });
  await page.getByLabel("Quantidade").fill("5");
  await page.getByRole("button", { name: "Salvar" }).click();
  const row = page.locator("tr", { hasText: "Capacete de segurança (exemplo)" });
  await expect(row).toContainText("5");
  await expect(row).toContainText("abaixo do mínimo");

  await page.goto("/epis?aba=entregas");
  await page.getByRole("button", { name: "Registrar entrega" }).click();
  await page.getByLabel("Pessoa").selectOption({ label: "Voluntário E2E" });
  await page.getByLabel("EPI").selectOption({ label: "Capacete de segurança (exemplo)" });
  await page.getByLabel("Estoque de origem").selectOption({ label: "Unidade Local Alfa" });
  await page.getByLabel("Quantidade").fill("9");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(/Saldo insuficiente/)).toBeVisible();
  await page.getByLabel("Quantidade").fill("2");
  await page.getByLabel("Confirmação de recebimento").selectOption({ label: "Termo em papel arquivado" });
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.locator("tr", { hasText: "Voluntário E2E" })).toBeVisible();
  await page.goto("/epis");
  await expect(page.locator("tr", { hasText: "Capacete de segurança (exemplo)" })).toContainText("3");
  console.assertClean();
});
