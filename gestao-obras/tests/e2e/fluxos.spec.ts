import { expect, test } from "@playwright/test";
import { authenticator } from "otplib";
import { db, login, watchConsole } from "./helpers";

test.afterAll(async () => db.$disconnect());

test("página protegida redireciona para o login e senha errada exibe erro genérico", async ({ page }) => {
  const console = watchConsole(page);
  await page.goto("/organizacao");
  await expect(page).toHaveURL(/\/login\?next=%2Forganizacao/);
  await login(page, "consulta.alfa@exemplo.test", "senha-errada");
  await expect(page.getByRole("alert").filter({ hasText: "E-mail ou senha inválidos." })).toBeVisible();
  console.assertClean();
});

test("cabeçalhos de segurança e CSP com nonce estão presentes", async ({ page }) => {
  const res = await page.goto("/login");
  const h = res!.headers();
  expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
});

test("perfil de consulta vê apenas a própria unidade e não acessa outra região", async ({ page }) => {
  const console = watchConsole(page);
  await login(page, "consulta.alfa@exemplo.test");
  await expect(page.getByRole("heading", { name: "Painel" })).toBeVisible();
  const nav = page.getByRole("navigation", { name: "Menu principal" });
  await expect(nav.getByRole("link", { name: "Usuários" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Auditoria" })).toHaveCount(0);

  await nav.getByRole("link", { name: "Estrutura organizacional" }).click();
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("Unidade Local Alfa");
  await expect(page.getByRole("link", { name: "Nova unidade" })).toHaveCount(0);

  const gama = await db.organizationUnit.findUniqueOrThrow({ where: { code: "UL-GAMA" } });
  await page.goto(`/organizacao/${gama.id}`);
  await expect(page.getByRole("heading", { name: "Página não encontrada" })).toBeVisible();

  const api = await page.request.get(`/api/org-units/${gama.id}`);
  expect(api.status()).toBe(404);
  await page.goto("/auditoria");
  await expect(page.getByText("Acesso não permitido")).toBeVisible();
  console.assertClean();
});

test("administrador: cadastro obrigatório de MFA, criação de unidade e verificação da auditoria", async ({ page }) => {
  const console = watchConsole(page);
  await login(page, "admin@exemplo.test");
  await expect(page).toHaveURL(/\/mfa\/cadastro$/);
  await page.getByRole("button", { name: "Gerar QR Code" }).click();
  await page.getByText("Não consegue ler o QR Code?").click();
  const secret = (await page.getByTestId("mfa-secret").textContent())!.trim();
  await page.getByLabel("Código de 6 dígitos").fill(authenticator.generate(secret));
  await page.getByRole("button", { name: "Confirmar e ativar" }).click();
  await expect(page.getByTestId("recovery-codes").locator("li")).toHaveCount(8);
  await page.getByRole("button", { name: "Guardei os códigos, continuar" }).click();
  await expect(page.getByRole("heading", { name: "Painel" })).toBeVisible();

  // Criação de unidade com validação no servidor.
  await page.goto("/organizacao/nova");
  await page.getByRole("button", { name: "Criar unidade" }).click();
  await expect(page.getByText("Verifique os campos destacados.")).toBeVisible();
  await page.getByLabel("Nome").first().fill("Unidade Local Épsilon");
  await page.getByLabel("Código").fill("UL-EPSILON");
  await page.getByLabel("Unidade superior").selectOption({ label: "— Região Demonstração Norte (REG-DEMO-NORTE)" });
  await page.getByLabel("Tipo").selectOption({ label: "Congregação / unidade local" });
  await page.getByLabel("CEP").fill("12345-678");
  await page.getByLabel("UF").selectOption("SP");
  await page.getByRole("button", { name: "Criar unidade" }).click();
  await expect(page.getByRole("heading", { name: "Unidade Local Épsilon" })).toBeVisible();
  await expect(page.getByText("subordinada a")).toContainText("Região Demonstração Norte");

  // Trilha de auditoria registra a criação e a cadeia é íntegra.
  await page.goto("/auditoria?action=org.unidade.criada");
  await expect(page.locator("tbody tr").first()).toContainText("org.unidade.criada");
  await page.getByRole("button", { name: "Verificar integridade" }).click();
  await expect(page.getByText(/Cadeia íntegra/)).toBeVisible();

  // Unidade criada por engano e sem histórico pode ser removida (com justificativa).
  const eps = await db.organizationUnit.findUniqueOrThrow({ where: { code: "UL-EPSILON" } });
  await page.goto(`/organizacao/${eps.id}`);
  await page.getByRole("button", { name: "Remover unidade" }).click();
  const dlg = page.getByRole("dialog");
  await dlg.getByLabel("Justificativa").fill("Criada por engano no teste.");
  await dlg.getByRole("button", { name: "Remover" }).click();
  await expect(page.getByRole("heading", { name: "Região Demonstração Norte" })).toBeVisible();
  expect(await db.organizationUnit.findUnique({ where: { code: "UL-EPSILON" } })).toBeNull();

  // Novo login exige o segundo fator.
  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login/);
  await login(page, "admin@exemplo.test");
  await expect(page).toHaveURL(/\/mfa$/);
  const next = authenticator.clone({ epoch: Date.now() + 30_000 }).generate(secret);
  await page.getByLabel("Código").fill(next);
  await page.getByRole("button", { name: "Verificar" }).click();
  await expect(page.getByRole("heading", { name: "Painel" })).toBeVisible();
  console.assertClean();
});

test("gestor regional não consegue conceder acesso acima do próprio nível", async ({ page }) => {
  // Habilita o gestor Norte com MFA já cadastrado diretamente no banco de testes.
  const gestor = await db.user.findUniqueOrThrow({ where: { email: "gestor.norte@exemplo.test" } });
  await login(page, gestor.email);
  await expect(page).toHaveURL(/\/mfa\/cadastro$/);
  await page.getByRole("button", { name: "Gerar QR Code" }).click();
  await page.getByText("Não consegue ler o QR Code?").click();
  const secret = (await page.getByTestId("mfa-secret").textContent())!.trim();
  await page.getByLabel("Código de 6 dígitos").fill(authenticator.generate(secret));
  await page.getByRole("button", { name: "Confirmar e ativar" }).click();
  await page.getByRole("button", { name: "Guardei os códigos, continuar" }).click();

  await page.getByRole("navigation", { name: "Menu principal" }).getByRole("link", { name: "Usuários" }).click();
  await expect(page.locator("tbody")).toContainText("Consulta Alfa Demonstração");
  await expect(page.locator("tbody")).not.toContainText("Gestor Sul Demonstração");
  await page.getByRole("link", { name: "Consulta Alfa Demonstração" }).click();
  await page.getByLabel("Unidade", { exact: true }).selectOption({ label: "— — Unidade Local Alfa" });
  const roleOptions = await page.getByLabel("Papel").locator("option").allTextContents();
  expect(roleOptions).not.toContain("Administrador do sistema");
  expect(roleOptions).toContain("Consulta");

  // Mesmo forçando pela API, o servidor recusa.
  const adminRole = await db.role.findUniqueOrThrow({ where: { code: "ADMIN_SISTEMA" } });
  const alfa = await db.organizationUnit.findUniqueOrThrow({ where: { code: "UL-ALFA" } });
  const target = await db.user.findUniqueOrThrow({ where: { email: "consulta.alfa@exemplo.test" } });
  const res = await page.request.post(`/api/users/${target.id}/scopes`, {
    data: { roleId: adminRole.id, unitId: alfa.id, includeDescendants: true },
    headers: { Origin: "http://localhost:3100" },
  });
  expect(res.status()).toBe(403);
});
