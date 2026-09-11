// =====================================================================
// VARREDURA DE NAVEGADOR — Academia ConServ
// ---------------------------------------------------------------------
// Abre TODAS as telas (colaborador e administração, no computador e no
// celular) e procura:
//   · erro de JavaScript ou de console
//   · tela em branco
//   · rolagem horizontal no celular
//   · botão/link sem nome acessível, campo sem rótulo, id repetido
// Depois executa os fluxos principais de ponta a ponta (aula, quiz,
// jogos, risco, painel administrativo).
//
// Como rodar:
//   npm i -D playwright        (uma vez; baixa o navegador)
//   npm run build && npm run preview     (num terminal)
//   npm run smoke:academia               (noutro terminal)
//
// Endereço alternativo: SMOKE_URL=http://localhost:5173/academia.html
// Navegador alternativo:  CHROME_PATH=/caminho/para/chrome
// =====================================================================

import fs from "node:fs";
import path from "node:path";
import { montarPdf, PAGINAS_EXEMPLO } from "./lib/pdf-de-teste.mjs";

const URL_BASE = process.env.SMOKE_URL ?? "http://localhost:4173/academia.html";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  try {
    ({ chromium } = await import("playwright-core"));
  } catch {
    console.error(
      "\nEsta varredura precisa do Playwright.\n" +
      "Instale com:  npm i -D playwright\n" +
      "(os testes de motores e de conteúdo rodam sem ele: npm run test:academia)\n",
    );
    process.exit(1);
  }
}

const problemas = [];
const notas = [];
let ok = 0;
let falhas = 0;
const check = (nome, cond, detalhe = "") => {
  if (cond) { ok += 1; console.log(`  ok    ${nome}${detalhe ? " — " + detalhe : ""}`); }
  else { falhas += 1; console.log(`  FALHA ${nome}${detalhe ? " — " + detalhe : ""}`); }
};

const ROTAS_COLABORADOR = [
  "/", "/trilhas", "/trilha/PTH-06", "/curso/CRS-001", "/curso/CRS-001/aula/LES-COST-FUND-01",
  "/quiz/QIZ-LES-REG", "/jogos", "/jogos/GAM-000001", "/jogos/GAM-000003", "/jogos/GAM-000006",
  "/desafios", "/curiosidades", "/competencias", "/certificados", "/apostilas", "/risco",
  "/posto", "/cultura", "/perfil", "/notificacoes", "/rota-que-nao-existe",
];
const ROTAS_ADMIN = [
  "/admin", "/admin/conteudos", "/admin/conteudos/novo", "/admin/conteudos/CNT-000001",
  "/admin/colaboradores", "/admin/colaboradores/EMP-0001", "/admin/cursos", "/admin/cursos/CRS-001",
  "/admin/apostilas", "/admin/quizzes", "/admin/jogos", "/admin/competencias", "/admin/certificados",
  "/admin/trilhas", "/admin/nr1", "/admin/fontes", "/admin/riscos", "/admin/relatorios",
  "/admin/auditoria", "/admin/configuracoes", "/admin/rota-que-nao-existe",
];

function ligarEscutas(page) {
  page.on("pageerror", (e) => problemas.push(`[JS] ${page.url().split("#")[1] ?? "?"} → ${e.message.split("\n")[0]}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const texto = m.text();
    if (texto.includes("ERR_") || texto.includes("fonts.googleapis")) return; // rede indisponível
    if (texto.includes("simulação: sem conexão")) return; // falha de gravação provocada pela regressão 6
    problemas.push(`[console] ${page.url().split("#")[1] ?? "?"} → ${texto.slice(0, 140)}`);
  });
}

async function entrar(page, nome) {
  // Recarrega de verdade: trocar só o "#" é navegação no mesmo documento
  // e a sessão em memória continuaria válida.
  await page.goto(URL_BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.removeItem("academia:session:v1"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("text=Acesso de demonstração", { timeout: 30000 });
  await page.locator("button", { hasText: nome }).click();
  await page.waitForTimeout(900);
  const pular = page.locator("button", { hasText: "Ver meu painel primeiro" });
  if (await pular.count()) { await pular.click(); await page.waitForTimeout(500); }
}

async function auditar(page, largura) {
  return page.evaluate((vw) => {
    const visivel = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
    };
    const nome = (el) =>
      (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").trim() ||
      (el.querySelector("img[alt]")?.getAttribute("alt") || "").trim();
    const out = { semNome: [], semAlt: 0, semRotulo: 0, idsRepetidos: [], overflow: null };
    document.querySelectorAll("button, a[href]").forEach((el) => {
      if (visivel(el) && !nome(el)) out.semNome.push(el.tagName + "." + String(el.className).slice(0, 50));
    });
    document.querySelectorAll("img").forEach((img) => { if (!img.hasAttribute("alt")) out.semAlt += 1; });
    document.querySelectorAll("input, select, textarea").forEach((el) => {
      if (!visivel(el)) return;
      const rotulado = el.closest("label") || (el.id && document.querySelector(`label[for="${el.id}"]`)) ||
        el.getAttribute("aria-label") || el.getAttribute("placeholder");
      if (!rotulado) out.semRotulo += 1;
    });
    const vistos = new Set();
    document.querySelectorAll("[id]").forEach((el) => {
      if (vistos.has(el.id)) out.idsRepetidos.push(el.id);
      vistos.add(el.id);
    });
    if (document.documentElement.scrollWidth > vw + 1) {
      out.overflow = { scrollWidth: document.documentElement.scrollWidth, viewport: vw };
    }
    return out;
  }, largura);
}

async function varrer(page, rotas, rotulo, largura) {
  for (const rota of rotas) {
    try {
      await page.goto(`${URL_BASE}#${rota}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(400);
      const corpo = (await page.locator("body").innerText()).trim();
      if (corpo.length < 40) problemas.push(`[vazio] ${rotulo} ${rota}`);
      const a = await auditar(page, largura);
      if (a.overflow) problemas.push(`[layout] ${rotulo} ${rota} → rolagem horizontal (${a.overflow.scrollWidth}px > ${a.overflow.viewport}px)`);
      if (a.semNome.length) problemas.push(`[a11y] ${rotulo} ${rota} → ${a.semNome.length} botão/link sem nome: ${a.semNome.slice(0, 2).join(" | ")}`);
      if (a.semAlt) problemas.push(`[a11y] ${rotulo} ${rota} → ${a.semAlt} imagem(ns) sem alt`);
      if (a.semRotulo) problemas.push(`[a11y] ${rotulo} ${rota} → ${a.semRotulo} campo(s) sem rótulo`);
      if (a.idsRepetidos.length) problemas.push(`[html] ${rotulo} ${rota} → ids repetidos: ${[...new Set(a.idsRepetidos)].slice(0, 2).join(", ")}`);
    } catch (e) {
      problemas.push(`[falha] ${rotulo} ${rota} → ${String(e.message).split("\n")[0]}`);
    }
  }
}

// Navegador: usa CHROME_PATH quando informado; senão tenta um Chromium
// já presente na máquina antes de cair no download do Playwright.
function acharNavegador() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidatos = ["/opt/pw-browsers", "/usr/lib/chromium", "/usr/bin"];
  for (const base of candidatos) {
    let nomes = [];
    try { nomes = fs.readdirSync(base); } catch { continue; }
    for (const nome of nomes.sort().reverse()) {
      for (const sufixo of ["chrome-linux/chrome", "chrome", "chromium"]) {
        const caminho = path.join(base, nome, sufixo);
        if (fs.existsSync(caminho) && fs.statSync(caminho).isFile()) return caminho;
      }
      const direto = path.join(base, nome);
      if (/^(chrome|chromium)$/.test(nome) && fs.existsSync(direto) && fs.statSync(direto).isFile()) return direto;
    }
  }
  return undefined;
}

const navegador = await chromium.launch({ executablePath: acharNavegador() });

console.log(`\nVarrendo ${URL_BASE}\n`);
console.log("── telas ──");
const desktop = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
ligarEscutas(desktop);
await entrar(desktop, "Maria Aparecida Silva");
await varrer(desktop, ROTAS_COLABORADOR, "computador/colaborador", 1280);

await desktop.goto(`${URL_BASE}#/admin`, { waitUntil: "networkidle" });
await desktop.waitForTimeout(500);
check("colaborador não entra na área administrativa", (await desktop.locator("text=Acesso restrito").count()) > 0);

await entrar(desktop, "Coordenação de Treinamento");
await varrer(desktop, ROTAS_ADMIN, "computador/admin", 1280);

const celular = await navegador.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
ligarEscutas(celular);
await entrar(celular, "Maria Aparecida Silva");
await varrer(celular, ROTAS_COLABORADOR, "celular/colaborador", 390);

console.log("\n── fluxos ──");
const page = desktop;
await entrar(page, "Maria Aparecida Silva");

// aula → conclusão
await page.goto(`${URL_BASE}#/curso/CRS-004/aula/LES-CORTE-INT-02`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const concluir = page.locator("button", { hasText: "Concluir aula" });
if (await concluir.count()) { await concluir.click(); await page.waitForTimeout(800); }
check("aula é concluída e registra progresso", (await page.locator("text=Concluída").count()) > 0 || (await page.locator("text=Próxima aula").count()) > 0);

// quiz completo (e envio duplicado no fim)
const contarTentativas = () =>
  page.evaluate(() => {
    let n = 0;
    for (let i = 0; i < localStorage.length; i += 1) {
      if ((localStorage.key(i) ?? "").startsWith("academia:v1:quiz_attempts:")) n += 1;
    }
    return n;
  });
const questaoAtual = () =>
  page.evaluate(() => {
    const m = document.body.innerText.match(/Questão (\d+) de (\d+)/);
    return m ? Number(m[1]) : 0;
  });

await page.goto(`${URL_BASE}#/quiz/QIZ-NR1-RAPIDO`, { waitUntil: "networkidle" });
await page.waitForSelector("text=Questão 1 de", { timeout: 15000 });
const tentativasAntes = await contarTentativas();
let travou = false;
for (let i = 0; i < 12; i += 1) {
  const atual = await questaoAtual();
  if (!atual) break;
  const alternativas = page.locator("button", { has: page.locator("span", { hasText: /^[A-D]$/ }) });
  if (!(await alternativas.count())) break;
  await alternativas.first().click();
  await page.waitForTimeout(150);

  // Atenção: o texto das alternativas pode conter "próxima" ("porta mais
  // próxima"), por isso o botão é localizado pelo nome exato.
  const finalizar = page.getByRole("button", { name: "Finalizar", exact: true });
  if (await finalizar.count()) {
    // Toque repetido no celular: tem de gravar UMA tentativa só.
    await finalizar.first().click({ clickCount: 2, delay: 30 }).catch(() => {});
    break;
  }
  const proxima = page.getByRole("button", { name: "Próxima", exact: true });
  if (!(await proxima.count())) break;
  // O clique sintético pode cair fora do botão quando o cartão muda de
  // altura entre questões; confirma que avançou e repete se não avançou.
  let avancou = false;
  for (let tentativa = 0; tentativa < 3 && !avancou; tentativa += 1) {
    await proxima.first().click();
    await page.waitForTimeout(300);
    avancou = (await questaoAtual()) !== atual;
  }
  if (!avancou) { travou = true; break; }
}
await page.waitForTimeout(1000);
check("quiz avança de questão sem travar", !travou);
check("quiz corrige e mostra a revisão com fonte", (await page.locator("text=Revisão das questões").count()) > 0);
check("toque repetido em Finalizar grava uma tentativa só", (await contarTentativas()) - tentativasAntes === 1,
  `${(await contarTentativas()) - tentativasAntes} tentativa(s)`);

// jogo de observação
await page.goto(`${URL_BASE}#/jogos/GAM-000003`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
for (const alvo of ["Caixa no corredor de passagem", "Retalho e fiapo no piso", "Proteção de agulha removida", "Cabo elétrico solto atravessando o piso"]) {
  const ponto = page.locator(`[aria-label="${alvo}"]`);
  if (await ponto.count()) { await ponto.click(); await page.waitForTimeout(200); }
}
check("caça ao risco reconhece a cena completa", (await page.locator("text=Cena completa").count()) > 0);

// registro de risco
await page.goto(`${URL_BASE}#/risco`, { waitUntil: "networkidle" });
await page.locator("textarea").first().fill("Varredura automatizada: caixa obstruindo a passagem perto da saída.");
await page.locator("button", { hasText: "Enviar registro" }).click();
await page.waitForTimeout(900);
check("registro de risco é aceito", (await page.locator("text=Registro enviado").count()) > 0);

// administração: analisar um material novo e aprovar questões
await entrar(page, "Coordenação de Treinamento");
await page.goto(`${URL_BASE}#/admin/conteudos/novo`, { waitUntil: "networkidle" });
await page.locator('input[placeholder="Ex.: Regulagem da Overloque"]').fill("Varredura: cuidados com a agulha");
await page.locator('textarea[placeholder="Cole aqui o texto do material…"]').fill(
  `A agulha é a peça mais barata da máquina e a que causa os defeitos mais caros.\n\n` +
  `A ponta esférica afasta os fios da malha em vez de cortá-los, por isso é obrigatória em malha.\n\n` +
  `Roteiro de troca de agulha:\n1. Pare a máquina.\n2. Solte o parafuso do prendedor.\n3. Coloque a agulha até o fundo do cabeçote.\n4. Confira a canaleta voltada para o lado correto.\n5. Aperte o parafuso e teste em retalho.`,
);
await page.locator("button", { hasText: "Analisar conteúdo" }).click();
await page.waitForSelector("text=Conteúdo identificado", { timeout: 40000 });
check("material novo é analisado e gera sugestões", (await page.locator("text=Conteúdo identificado").count()) > 0);
await page.locator("button", { hasText: "Questões" }).first().click();
await page.waitForTimeout(500);
await page.locator("button", { hasText: "Selecionar todas" }).click();
await page.waitForTimeout(200);
await page.locator("button", { hasText: "Aprovar selecionadas" }).click();
await page.waitForTimeout(800);
check("questões sugeridas viram questões aprovadas", (await page.locator("text=aprovadas").count()) > 0);

// administração: ler e analisar um PDF de verdade
await page.goto(`${URL_BASE}#/admin/conteudos/novo`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.locator('input[type="file"]').setInputFiles({
  name: "pressao-do-pe-calcador.pdf",
  mimeType: "application/pdf",
  buffer: montarPdf(PAGINAS_EXEMPLO),
});
// O rótulo já existe com "0 trecho(s)" antes de a leitura terminar: a
// espera é pelo número, não pelo texto.
await page.waitForFunction(() => {
  const m = document.body.innerText.match(/(\d+) trecho\(s\) extraídos/);
  return !!m && Number(m[1]) > 0;
}, null, { timeout: 60000 });
const trechosDoPdf = Number(
  (await page.evaluate(() => document.body.innerText.match(/(\d+) trecho\(s\) extraídos/)?.[1])) ?? 0,
);
check("PDF é lido no navegador (uma página, um trecho)", trechosDoPdf >= 2, `${trechosDoPdf} trecho(s)`);
check("título vem do nome do arquivo",
  (await page.locator('input[placeholder="Ex.: Regulagem da Overloque"]').inputValue()).includes("pressao"));
await page.locator("button", { hasText: "Analisar conteúdo" }).click();
await page.waitForSelector("text=Conteúdo identificado", { timeout: 60000 });
check("análise do PDF identifica o conteúdo", (await page.locator("text=Conteúdo identificado").count()) > 0);
const textoDaAnalise = await page.locator("body").innerText();
check("a análise usa o texto do PDF", /calcador|arraste|transporte/i.test(textoDaAnalise));

// A página do PDF tem de continuar registrada na fonte (rastreabilidade).
const fonte = page.getByRole("button", { name: "Fonte", exact: true });
if (await fonte.count()) {
  await fonte.first().click();
  await page.waitForTimeout(400);
}
check("a página do PDF fica registrada como fonte", /página \d+/i.test(await page.locator("body").innerText()));

// O mesmo PDF, agora com a criação de worker BLOQUEADA — é o que o
// navegador faz numa página publicada ou embutida. A leitura tem de
// continuar funcionando, porque roda no thread da própria página.
{
  const semWorker = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
  await semWorker.addInitScript(() => {
    Object.defineProperty(window, "Worker", {
      configurable: true,
      value: function () { throw new Error("worker bloqueado pelo navegador"); },
    });
  });
  try {
    await entrar(semWorker, "Coordenação de Treinamento");
    await semWorker.goto(`${URL_BASE}#/admin/conteudos/novo`, { waitUntil: "networkidle" });
    await semWorker.waitForTimeout(600);
    await semWorker.locator('input[type="file"]').setInputFiles({
      name: "pressao-do-pe-calcador.pdf",
      mimeType: "application/pdf",
      buffer: montarPdf(PAGINAS_EXEMPLO),
    });
    await semWorker.waitForFunction(() => {
      const m = document.body.innerText.match(/(\d+) trecho\(s\) extraídos/);
      return !!m && Number(m[1]) > 0;
    }, null, { timeout: 60000 });
    const trechos = await semWorker.evaluate(
      () => document.body.innerText.match(/(\d+) trecho\(s\) extraídos/)?.[1] ?? "0",
    );
    check("PDF é lido mesmo sem poder criar worker (página publicada)", Number(trechos) > 0, `${trechos} trecho(s)`);
  } catch (e) {
    check("PDF é lido mesmo sem poder criar worker (página publicada)", false, String(e.message).split("\n")[0]);
  }
  await semWorker.close();
}

// =====================================================================
// REGRESSÕES — defeitos já corrigidos que não podem voltar
// =====================================================================
console.log("\n── regressões ──");

// 1) Link compartilhado (ou QR Code) tem de sobreviver ao login.
await page.goto(URL_BASE, { waitUntil: "networkidle" });
await page.evaluate(() => window.localStorage.removeItem("academia:session:v1"));
await page.goto(`${URL_BASE}#/curso/CRS-003`, { waitUntil: "networkidle" });
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector("text=Acesso de demonstração", { timeout: 30000 });
check("link direto sem sessão cai na tela de entrada", (await page.locator("text=Entrar na Academia").count()) > 0);

// 2) Os perfis de demonstração não podem mudar a cada recarregamento.
const perfisVisiveis = () =>
  page.$$eval("button", (bs) =>
    bs.filter((b) => b.className.includes("rounded-xl") && b.querySelector(".truncate"))
      .map((b) => b.innerText.split("\n").slice(1, 2).join("")));
const perfis1 = await perfisVisiveis();
await page.reload({ waitUntil: "networkidle" });
await page.waitForSelector("text=Acesso de demonstração", { timeout: 30000 });
const perfis2 = await perfisVisiveis();
check("perfis de demonstração são os mesmos depois do F5", perfis1.join("|") === perfis2.join("|"), perfis2.join(" · "));
check("a demonstração oferece um perfil de cada papel", perfis1.length === 4, `${perfis1.length} perfil(is)`);

await page.locator("button", { hasText: "Maria Aparecida Silva" }).click();
await page.waitForTimeout(1200);
const pular = page.locator("button", { hasText: "Ver meu painel primeiro" });
if (await pular.count()) { await pular.click(); await page.waitForTimeout(500); }
check("depois de entrar, abre o endereço pedido", (await page.locator("h1").first().innerText()).includes("Qualidade"),
  await page.locator("h1").first().innerText());

// 3) O progresso da aula tem de sobreviver ao F5.
await page.goto(`${URL_BASE}#/curso/CRS-004/aula/LES-CORTE-INT-01`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
const concluirAula = page.locator("button", { hasText: "Concluir aula" });
if (await concluirAula.count()) { await concluirAula.click(); await page.waitForTimeout(900); }
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);
check("aula continua concluída depois do F5", (await page.locator("text=Concluída").count()) > 0);

// 4) Impressão: apostila e certificado saem sem o menu e com o QR Code.
await page.emulateMedia({ media: "print" });
await page.goto(`${URL_BASE}#/apostila/HBK-000001`, { waitUntil: "networkidle" });
await page.waitForTimeout(900);
check("menu lateral não sai na impressão da apostila",
  await page.evaluate(() => { const m = document.querySelector("aside"); return !m || getComputedStyle(m).display === "none"; }));
await page.goto(`${URL_BASE}#/certificado/CSV-7K2M-QX84`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
check("certificado mantém o QR Code na impressão", (await page.locator("img[alt*='QR Code']").count()) > 0);
await page.emulateMedia({ media: "screen" });

// 5) Diálogo: o foco entra ao abrir e volta ao botão de origem ao fechar.
await entrar(page, "Coordenação de Treinamento");
await page.goto(`${URL_BASE}#/admin/fontes`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.locator("button", { hasText: "Nova fonte" }).first().click();
await page.waitForTimeout(500);
check("foco entra no diálogo ao abrir", await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')));
await page.keyboard.press("Escape");
await page.waitForTimeout(500);
check("foco volta ao botão de origem ao fechar",
  await page.evaluate(() => (document.activeElement?.textContent || "").includes("Nova fonte")));

// 6) Sem conexão com o banco, a pessoa tem de ser avisada.
await page.goto(`${URL_BASE}#/`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.evaluate(() => {
  const original = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (String(k).startsWith("academia:v1:")) throw new Error("simulação: sem conexão");
    return original.call(this, k, v);
  };
});
await page.goto(`${URL_BASE}#/risco`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.locator("textarea").first().fill("Varredura: teste de falha de gravação.");
await page.locator("button", { hasText: "Enviar registro" }).click();
await page.waitForTimeout(1200);
check("avisa quando não consegue salvar no banco", (await page.locator("text=Não foi possível salvar no banco").count()) > 0);

await navegador.close();

console.log(`\n=== fluxos: ${ok} ok, ${falhas} falha(s) ===`);
console.log(`=== telas: ${problemas.length} problema(s) ===`);
for (const p of [...new Set(problemas)]) console.log("  ✗", p);
if (notas.length) for (const n of notas) console.log("  ·", n);
process.exit(falhas > 0 || problemas.length > 0 ? 1 : 0);
