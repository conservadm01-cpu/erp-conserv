import { expect, test } from "@playwright/test";
import { db, loginWithFreshMfa, watchConsole } from "./helpers";

test.afterAll(async () => db.$disconnect());

const tab = (page: import("@playwright/test").Page, name: RegExp) => page.getByRole("navigation", { name: "Seções" }).getByRole("link", { name });

test("gestão: orçamento aprovado pela central, medição, diário, cronograma e relatório", async ({ page }) => {
  test.setTimeout(150_000);
  const console = watchConsole(page);
  const alfa = await db.organizationUnit.findUniqueOrThrow({ where: { code: "UL-ALFA" } });
  const creator = await db.user.findUniqueOrThrow({ where: { email: "gestor.norte@exemplo.test" } });
  const work = await db.work.create({
    data: {
      code: "OB-E2E-00002", title: "Obra para orçamento", unitId: alfa.id, unitPath: alfa.path, typeCode: "REFORMA", status: "EM_EXECUCAO", scope: "Escopo.", justification: "Justificativa.", createdById: creator.id,
      stages: { create: [{ name: "Demolição", sortOrder: 1, plannedStart: new Date("2026-10-01"), plannedEnd: new Date("2026-10-10") }] },
    },
  });

  // 1. Gestor elabora o orçamento e submete.
  await loginWithFreshMfa(page, "gestor.norte@exemplo.test");
  await page.goto(`/obras/${work.id}?aba=orcamento`);
  await page.getByRole("button", { name: "Elaborar orçamento" }).click();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText(/Versão 1 · Rascunho/)).toBeVisible();
  await page.getByRole("button", { name: "Incluir linha" }).click();
  await page.getByLabel("Categoria").selectOption({ label: "Materiais" });
  await page.getByLabel("Descrição").fill("Telhas cerâmicas");
  await page.getByRole("textbox", { name: "Unidade", exact: true }).fill("m²");
  await page.getByLabel("Quantidade").fill("100");
  await page.getByLabel("Preço unitário (R$)").fill("45.5");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByRole("cell", { name: "Telhas cerâmicas" })).toBeVisible();
  await page.getByRole("button", { name: "Submeter à aprovação" }).click();
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText(/Versão 1 · Em aprovação/)).toBeVisible();
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login/);

  // 2. Analista central decide, vendo os itens submetidos.
  await loginWithFreshMfa(page, "analista@exemplo.test");
  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Aprovações" }).click();
  await page.locator("section[aria-labelledby=\"ap\"] tr", { hasText: "OB-E2E-00002" }).getByRole("link", { name: "Analisar", exact: true }).click();
  await expect(page.getByText("Orçamento v1 — OB-E2E-00002")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Telhas cerâmicas" })).toBeVisible();
  await page.getByLabel("Parecer").fill("Valores compatíveis com as cotações.");
  await page.getByRole("button", { name: "Aprovar", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText("Solicitação aprovada")).toBeVisible();
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login/);

  // 3. Gestor registra medição sobre o orçamento aprovado e o diário.
  await loginWithFreshMfa(page, "gestor.norte@exemplo.test");
  await page.goto(`/obras/${work.id}?aba=orcamento`);
  await expect(page.getByText("(orçamento aprovado v1)")).toBeVisible();
  await page.getByRole("button", { name: "Nova medição" }).click();
  await page.getByLabel("Quantidade de Telhas cerâmicas").fill("40");
  await expect(page.getByText("Total desta medição: R$ 1.820,00")).toBeVisible();
  await page.getByRole("button", { name: "Salvar medição (rascunho)" }).click();
  await expect(page.getByText(/Medição nº 1 .* Rascunho/)).toBeVisible();
  await page.getByRole("listitem").filter({ hasText: "Medição nº 1" }).getByRole("button", { name: "Submeter à aprovação" }).click();
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText(/Medição nº 1 .* Em aprovação/)).toBeVisible();

  await tab(page, /Diário/).click();
  await expect(page).toHaveURL(/aba=diario/);
  await page.getByRole("button", { name: "Registrar dia" }).click();
  await page.getByLabel("Atividades executadas").fill("Retirada das telhas antigas.");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Retirada das telhas antigas.")).toBeVisible();

  await tab(page, /Cronograma/).click();
  await expect(page).toHaveURL(/aba=etapas/);
  await expect(page.getByText("Demolição").first()).toBeVisible();

  // 4. Relatório de orçamento e medições em PDF, pela tela de relatórios.
  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Relatórios" }).click();
  const card = page.locator("form", { has: page.getByRole("heading", { name: "Orçamento e medições" }) });
  await card.getByLabel("Obra").selectOption({ label: "OB-E2E-00002 — Obra para orçamento" });
  const pdf = page.waitForEvent("download");
  await card.getByRole("button", { name: "Gerar PDF" }).click();
  expect((await pdf).suggestedFilename()).toBe("orcamento-medicoes-OB-E2E-00002.pdf");

  // Visão geral de orçamentos.
  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Orçamentos" }).click();
  await expect(page.getByRole("row", { name: /OB-E2E-00002/ })).toContainText("R$ 4.550,00");

  expect(await db.approval.count({ where: { workId: work.id, kind: "MEDICAO", status: "PENDENTE" } })).toBe(1);
  console.assertClean();
});

test("administração: parâmetros, alçadas por valor e solicitação de titular", async ({ page }) => {
  test.setTimeout(90_000);
  const console = watchConsole(page);
  const alfa = await db.organizationUnit.findUniqueOrThrow({ where: { code: "UL-ALFA" } });
  const admin = await db.user.findUniqueOrThrow({ where: { email: "admin@exemplo.test" } });
  await db.person.create({ data: { name: "Titular Fictício E2E", category: "VOLUNTARIO", unitId: alfa.id, unitPath: alfa.path, createdById: admin.id } });
  await loginWithFreshMfa(page, "admin@exemplo.test");

  // Parâmetro com limite validado no servidor.
  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Parâmetros" }).click();
  const field = page.getByRole("spinbutton", { name: "Alerta de desvio orçamentário (%)" });
  await field.fill("150");
  await field.locator("xpath=ancestor::form").getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Informe um número entre 0 e 100.").first()).toBeVisible();
  await field.fill("12");
  await field.locator("xpath=ancestor::form").getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Parâmetro atualizado.")).toBeVisible();

  // Faixas de alçada: exige exatamente uma faixa sem limite superior.
  await page.goto("/configuracoes/fluxos");
  const despesa = page.locator("form", { has: page.getByRole("heading", { name: /despesa/i }) }).last();
  await despesa.getByRole("button", { name: "Adicionar faixa" }).click();
  await despesa.getByRole("textbox", { name: "Faixa 1: até (R$)" }).fill("5000");
  await despesa.getByRole("button", { name: "Salvar faixas" }).click();
  await expect(despesa.getByText(/exatamente uma faixa sem limite/)).toBeVisible();
  await despesa.getByRole("button", { name: "Adicionar faixa" }).click();
  await despesa.getByRole("spinbutton", { name: "Decisões necessárias" }).nth(1).fill("2");
  await despesa.getByRole("button", { name: "Salvar faixas" }).click();
  await expect(despesa.getByText("Faixas salvas.")).toBeVisible();

  // Privacidade: localizar titular, registrar e exportar.
  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Privacidade (titulares)" }).click();
  await page.getByLabel("Nome ou e-mail do titular").fill("Titular Fictício");
  await page.getByRole("button", { name: "Buscar titular" }).click();
  await page.getByRole("button", { name: "Selecionar Titular Fictício E2E" }).click();
  await page.getByLabel("Tipo de pedido").selectOption({ label: "Acesso aos dados" });
  await page.getByLabel("Canal de recebimento").fill("e-mail");
  await page.getByLabel("Descrição do pedido").fill("Pedido de cópia dos dados.");
  await page.getByRole("button", { name: "Registrar solicitação" }).click();
  await expect(page.getByText("Pedido de cópia dos dados.")).toBeVisible();
  const file = page.waitForEvent("download");
  await page.getByRole("link", { name: "Exportar dados (JSON)" }).click();
  expect((await file).suggestedFilename()).toMatch(/^dados-titular-.+\.json$/);

  expect(await db.auditEvent.count({ where: { action: "sistema.parametro.alterado" } })).toBe(1);
  console.assertClean();
});
