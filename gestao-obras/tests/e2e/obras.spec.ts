import { expect, test } from "@playwright/test";
import { db, loginWithFreshMfa, watchConsole } from "./helpers";

test.afterAll(async () => db.$disconnect());

const PDF = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");

const tab = (page: import("@playwright/test").Page, name: RegExp) => page.getByRole("navigation", { name: "Seções" }).getByRole("link", { name });

async function confirmAction(page: import("@playwright/test").Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Confirmar" }).click();
  await expect(dialog).toBeHidden();
}

test("ciclo da obra: cadastro, documentos, requisitos, tramitação, aprovação central e dossiê", async ({ page }) => {
  const console = watchConsole(page);
  test.setTimeout(120_000);

  // 1. Gestor regional cadastra a obra.
  await loginWithFreshMfa(page, "gestor.norte@exemplo.test");
  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Obras" }).click();
  await page.getByRole("link", { name: "Nova obra" }).click();
  await expect(page.getByRole("heading", { name: "Nova obra" })).toBeVisible();
  await page.getByRole("combobox", { name: "Unidade", exact: true }).selectOption({ label: "— — Unidade Local Alfa" });
  await page.getByLabel("Título").fill("Reforma da cobertura");
  await page.getByLabel("Tipo de obra").selectOption({ label: "Reforma" });
  await page.getByLabel("Trabalho em altura").check();
  await page.getByLabel("Escopo").fill("Substituição de telhas e calhas danificadas.");
  await page.getByLabel("Justificativa").fill("Infiltrações em dias de chuva.");
  await page.getByRole("button", { name: "Cadastrar obra" }).click();
  await expect(page.getByRole("heading", { name: "Reforma da cobertura" })).toBeVisible();
  const code = (await page.locator("header, main").getByText(/^OB-\d{4}-\d{5}$/).first().textContent())!;
  expect(code).toMatch(/^OB-\d{4}-\d{5}$/);

  // 2. Requisitos: NR-35 aparece como pendente de confirmação, sem NR-10.
  await tab(page, /Requisitos/).click();
  await expect(page.getByText("NR-35 — Trabalho em altura")).toBeVisible();
  await expect(page.getByText("Pendente de confirmação").first()).toBeVisible();
  await expect(page.getByText("NR-10")).toHaveCount(0);

  // 3. Envio de documento e download pelo link temporário.
  await tab(page, /Documentos/).click();
  await page.getByRole("button", { name: "Enviar documento" }).click();
  await page.getByLabel("Categoria").selectOption({ label: "Projeto" });
  await page.getByLabel("Título").fill("Projeto da cobertura");
  await page.locator("#doc-file").setInputFiles({ name: "projeto.pdf", mimeType: "application/pdf", buffer: PDF });
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByText("Documento enviado. Ele aguarda análise.")).toBeVisible();
  await page.getByText("Versões (1)").click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar" }).click();
  expect((await download).suggestedFilename()).toBe("projeto.pdf");

  // Arquivo com extensão falsa é recusado pelo conteúdo.
  await page.getByRole("button", { name: "Enviar documento" }).click();
  await page.getByLabel("Categoria").selectOption({ label: "Outro" });
  await page.getByLabel("Título").fill("Arquivo suspeito");
  await page.locator("#doc-file").setInputFiles({ name: "falso.pdf", mimeType: "application/pdf", buffer: Buffer.from("<script>alert(1)</script>") });
  await page.getByRole("button", { name: "Enviar", exact: true }).click();
  await expect(page.getByText(/Formato não permitido/).first()).toBeVisible();
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();

  // 4. Tramitação até a aprovação.
  await confirmAction(page, "Enviar solicitação");
  await confirmAction(page, "Iniciar triagem");
  await confirmAction(page, "Enviar para aprovação");
  await expect(page.getByText("Em aprovação").first()).toBeVisible();

  // 5. Gestor não aprova a própria solicitação (nem vê o menu de aprovações).
  await expect(page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Aprovações" })).toHaveCount(0);
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login/);

  // 6. Analista central decide com parecer.
  await loginWithFreshMfa(page, "analista@exemplo.test");
  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Aprovações" }).click();
  const row = page.locator("section[aria-labelledby=\"ap\"] tr", { hasText: code });
  await row.getByRole("link", { name: "Analisar", exact: true }).click();
  await page.getByLabel(/Projeto da cobertura/).check();
  await page.getByLabel("Parecer").fill("Escopo compatível com a justificativa. Aprovado.");
  await page.getByRole("button", { name: "Aprovar", exact: true }).click();
  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText("Solicitação aprovada")).toBeVisible();

  // 7. Obra aprovada, histórico com parecer e dossiê em PDF.
  await page.getByRole("link", { name: "Abrir obra" }).click();
  await expect(page).toHaveURL(/\/obras\/[0-9a-f-]+$/);
  await expect(page.getByText("Aprovada").first()).toBeVisible();
  await tab(page, /Histórico/).click();
  await expect(page.getByText(/Escopo compatível com a justificativa/)).toBeVisible();
  const pdf = page.waitForEvent("download");
  await page.getByRole("link", { name: "Baixar dossiê (PDF)" }).click();
  expect((await pdf).suggestedFilename()).toBe(`dossie-${code}.pdf`);

  const work = await db.work.findUniqueOrThrow({ where: { code } });
  expect(await db.auditEvent.count({ where: { objectId: work.id, action: "relatorio.dossie.gerado" } })).toBe(1);
  console.assertClean();
});

test("gestor de outra região não acessa a obra nem seus documentos", async ({ page }) => {
  const work = await db.work.findFirstOrThrow({ where: { title: "Reforma da cobertura" }, include: { documents: { include: { versions: true } } } });
  await loginWithFreshMfa(page, "gestor.sul@exemplo.test");
  await page.goto(`/obras/${work.id}`);
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();
  const doc = work.documents[0]!;
  const res = await page.request.post(`/api/documents/${doc.id}/versions/${doc.versions[0]!.id}/download`, { headers: { Origin: "http://localhost:3100" } });
  expect(res.status()).toBe(404);
  await page.goto("/obras");
  await expect(page.getByText("Reforma da cobertura")).toHaveCount(0);
});
