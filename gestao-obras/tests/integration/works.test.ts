import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { MemoryStorage, setStorage } from "@/server/storage/storage";
import { verifyDownloadToken } from "@/server/storage/download-token";
import { createWork, getWork, listWorks, transitionWork, updateWork, createStage } from "@/server/services/work.service";
import { addDocumentVersion, listWorkDocuments, markExpiredDocuments, requestDownload, reviewDocument, searchDocuments, uploadDocument } from "@/server/services/document.service";
import { blockingIssues, listWorkRequirements, setEvaluation, validateRule, waiveEvaluation, createRule } from "@/server/services/requirement.service";
import { decideApproval, getApproval, listInbox, updatePolicy } from "@/server/services/approval.service";
import { generateWorkDossier } from "@/server/services/report.service";
import { addUserScope } from "@/server/services/user.service";
import { actorOf, makeTree, makeUser, meta } from "./fixtures";

const storage = new MemoryStorage();
const PDF = new TextEncoder().encode("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF");
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const EXE = new TextEncoder().encode("MZ\x90\x00 programa");

let t: Awaited<ReturnType<typeof makeTree>>;
let gestorA: Awaited<ReturnType<typeof makeUser>>;
let gestorB: Awaited<ReturnType<typeof makeUser>>;
let analista: Awaited<ReturnType<typeof makeUser>>;
let analista2: Awaited<ReturnType<typeof makeUser>>;
let admin: Awaited<ReturnType<typeof makeUser>>;

const baseWork = (unitId: string, extra: Record<string, unknown> = {}) =>
  ({ unitId, title: "Reforma do telhado", typeCode: "REFORMA", activities: ["TRABALHO_ALTURA"], priority: "MEDIA", executionMode: "VOLUNTARIOS", scope: "Troca de telhas e calhas.", justification: "Infiltrações recorrentes.", ...extra }) as never;

beforeAll(async () => {
  setStorage(storage);
  t = await makeTree();
  admin = await makeUser({ unit: t.root, role: "ADMIN_SISTEMA" });
  gestorA = await makeUser({ unit: t.regA, role: "GESTOR_REGIONAL" });
  gestorB = await makeUser({ unit: t.regB, role: "GESTOR_REGIONAL" });
  analista = await makeUser({ unit: t.root, role: "ANALISTA_CENTRAL" });
  analista2 = await makeUser({ unit: t.root, role: "ANALISTA_CENTRAL" });
});

async function workInApproval() {
  const a = await actorOf(gestorA);
  const w = await createWork(a, baseWork(t.a1.id), meta());
  let cur = await transitionWork(a, w.id, { action: "solicitar", version: w.version }, meta());
  cur = await transitionWork(a, w.id, { action: "iniciar_triagem", version: cur.version }, meta());
  cur = await transitionWork(a, w.id, { action: "enviar_aprovacao", version: cur.version, reason: null }, meta());
  const approval = await prisma.approval.findFirstOrThrow({ where: { workId: w.id, status: "PENDENTE" } });
  return { work: cur, approval };
}

describe("obras — cadastro, código e isolamento", () => {
  it("gera códigos únicos e sequenciais, mesmo em criações simultâneas", async () => {
    const a = await actorOf(gestorA);
    const works = await Promise.all(Array.from({ length: 8 }, () => createWork(a, baseWork(t.a1.id), meta())));
    const codes = works.map((w) => w.code);
    expect(new Set(codes).size).toBe(8);
    codes.forEach((c) => expect(c).toMatch(/^OB-\d{4}-\d{5}$/));
    expect(works[0]!.unitPath).toBe(t.a1.path);
  });

  it("gestor de outra região não vê, não altera e não transiciona a obra", async () => {
    const w = await createWork(await actorOf(gestorA), baseWork(t.a2.id), meta());
    const b = await actorOf(gestorB);
    expect((await listWorks(b)).map((x) => x.id)).not.toContain(w.id);
    await expect(getWork(b, w.id)).rejects.toMatchObject({ status: 404 });
    await expect(updateWork(b, w.id, { version: 1, title: "x" }, meta())).rejects.toMatchObject({ status: 404 });
    await expect(transitionWork(b, w.id, { action: "solicitar", version: 1 }, meta())).rejects.toMatchObject({ status: 404 });
    await expect(createWork(b, baseWork(t.a1.id), meta())).rejects.toMatchObject({ status: 404 });
  });

  it("escopo por obra dá acesso apenas àquela obra", async () => {
    const a = await actorOf(gestorA);
    const w1 = await createWork(a, baseWork(t.a1.id), meta());
    const w2 = await createWork(a, baseWork(t.a1.id), meta());
    const resp = await makeUser({ unit: t.a1 });
    const role = await prisma.role.findUniqueOrThrow({ where: { code: "RESPONSAVEL_OBRA" } });
    await addUserScope(a, resp.id, { roleId: role.id, workId: w1.id, includeDescendants: true }, meta());
    const r = await actorOf(resp);
    expect((await listWorks(r)).map((x) => x.id)).toEqual([w1.id]);
    await expect(getWork(r, w2.id)).rejects.toMatchObject({ status: 404 });
    await expect(createStage(r, w1.id, { name: "Fundação", sortOrder: 1, status: "NAO_INICIADA", progress: 0 } as never, meta())).resolves.toBeTruthy();
    // Escopo de obra não dá acesso à unidade nem a outras obras dela.
    await expect(createWork(r, baseWork(t.a1.id), meta())).rejects.toMatchObject({ status: 404 });
  });

  it("controle de concorrência e congelamento de escopo", async () => {
    const a = await actorOf(gestorA);
    const w = await createWork(a, baseWork(t.a1.id), meta());
    const u1 = await updateWork(a, w.id, { version: w.version, title: "Novo título" }, meta());
    await expect(updateWork(a, w.id, { version: w.version, title: "Conflitante" }, meta())).rejects.toMatchObject({ status: 409 });
    let cur = await transitionWork(a, w.id, { action: "solicitar", version: u1.version }, meta());
    cur = await transitionWork(a, w.id, { action: "iniciar_triagem", version: cur.version }, meta());
    cur = await transitionWork(a, w.id, { action: "enviar_aprovacao", version: cur.version }, meta());
    await expect(updateWork(a, w.id, { version: cur.version, scope: "Mudança indevida" }, meta())).rejects.toMatchObject({ status: 409 });
  });
});

describe("obras — máquina de estados", () => {
  it("rejeita transições inexistentes e exige justificativa quando aplicável", async () => {
    const a = await actorOf(gestorA);
    const w = await createWork(a, baseWork(t.a1.id), meta());
    await expect(transitionWork(a, w.id, { action: "iniciar_execucao", version: w.version }, meta())).rejects.toMatchObject({ status: 409 });
    await expect(transitionWork(a, w.id, { action: "cancelar", version: w.version, reason: "curto" }, meta())).rejects.toMatchObject({ status: 422 });
    const c = await transitionWork(a, w.id, { action: "cancelar", version: w.version, reason: "Solicitação duplicada por engano." }, meta());
    expect(c.status).toBe("ARQUIVADA");
    const hist = await prisma.workStatusChange.findMany({ where: { workId: w.id }, orderBy: { createdAt: "asc" } });
    expect(hist.map((h) => h.toStatus)).toEqual(["RASCUNHO", "ARQUIVADA"]);
  });

  it("aprovação só acontece pela decisão registrada, não por transição manual", async () => {
    const { work } = await workInApproval();
    await expect(transitionWork(await actorOf(gestorA), work.id, { action: "aprovar", version: work.version }, meta())).rejects.toMatchObject({ status: 409 });
  });
});

describe("aprovação central", () => {
  it("solicitante não decide a própria solicitação; outro aprovador decide com parecer", async () => {
    const { work, approval } = await workInApproval();
    await expect(decideApproval(await actorOf(gestorA), approval.id, { decision: "APROVAR", opinion: "Parecer favorável.", consultedDocumentIds: [] }, meta())).rejects.toMatchObject({ status: 403 });
    const res = await decideApproval(await actorOf(analista), approval.id, { decision: "APROVAR", opinion: "Escopo e justificativa adequados.", consultedDocumentIds: [] }, meta());
    expect(res.status).toBe("APROVADA");
    expect((await prisma.work.findUniqueOrThrow({ where: { id: work.id } })).status).toBe("APROVADA");
    const step = await prisma.approvalStep.findFirstOrThrow({ where: { approvalId: approval.id } });
    expect(step.opinion).toContain("adequados");
    await expect(decideApproval(await actorOf(analista2), approval.id, { decision: "APROVAR", opinion: "Tarde demais.", consultedDocumentIds: [] }, meta())).rejects.toMatchObject({ status: 409 });
  });

  it("segregação vale também para o administrador quando ele é o solicitante", async () => {
    const adm = await actorOf(admin);
    const w = await createWork(adm, baseWork(t.a1.id), meta());
    let cur = await transitionWork(adm, w.id, { action: "solicitar", version: w.version }, meta());
    cur = await transitionWork(adm, w.id, { action: "iniciar_triagem", version: cur.version }, meta());
    await transitionWork(adm, w.id, { action: "enviar_aprovacao", version: cur.version }, meta());
    const ap = await prisma.approval.findFirstOrThrow({ where: { workId: w.id } });
    await expect(decideApproval(adm, ap.id, { decision: "APROVAR", opinion: "Aprovando a minha própria.", consultedDocumentIds: [] }, meta())).rejects.toMatchObject({ status: 403 });
  });

  it("alçada configurável: com duas decisões exigidas, a primeira não conclui", async () => {
    await updatePolicy(await actorOf(admin), "SOLICITACAO_OBRA", { stepsRequired: 2, requireSegregation: true }, meta());
    try {
      const { work, approval } = await workInApproval();
      const r1 = await decideApproval(await actorOf(analista), approval.id, { decision: "APROVAR", opinion: "Primeira análise ok.", consultedDocumentIds: [] }, meta());
      expect(r1).toMatchObject({ status: "PENDENTE", remaining: 1 });
      await expect(decideApproval(await actorOf(analista), approval.id, { decision: "APROVAR", opinion: "De novo eu.", consultedDocumentIds: [] }, meta())).rejects.toMatchObject({ status: 409 });
      const r2 = await decideApproval(await actorOf(analista2), approval.id, { decision: "APROVAR", opinion: "Segunda análise ok.", consultedDocumentIds: [] }, meta());
      expect(r2.status).toBe("APROVADA");
      expect((await prisma.work.findUniqueOrThrow({ where: { id: work.id } })).status).toBe("APROVADA");
    } finally {
      await updatePolicy(await actorOf(admin), "SOLICITACAO_OBRA", { stepsRequired: 1, requireSegregation: true }, meta());
    }
  });

  it("devolução retorna a obra ao rascunho e fica no histórico", async () => {
    const { work, approval } = await workInApproval();
    await decideApproval(await actorOf(analista), approval.id, { decision: "DEVOLVER", opinion: "Detalhar melhor o escopo.", consultedDocumentIds: [] }, meta());
    const w = await prisma.work.findUniqueOrThrow({ where: { id: work.id } });
    expect(w.status).toBe("RASCUNHO");
    const last = await prisma.workStatusChange.findFirstOrThrow({ where: { workId: work.id }, orderBy: { createdAt: "desc" } });
    expect(last).toMatchObject({ toStatus: "RASCUNHO", reason: "Detalhar melhor o escopo.", approvalId: approval.id });
  });

  it("fila mostra só aprovações do escopo; gestor sem permissão não decide", async () => {
    const { approval } = await workInApproval();
    const inbox = await listInbox(await actorOf(analista));
    expect(inbox.approvals.map((a) => a.id)).toContain(approval.id);
    expect((await listInbox(await actorOf(gestorB))).approvals).toEqual([]);
    await expect(getApproval(await actorOf(gestorB), approval.id)).rejects.toMatchObject({ status: 404 });
    await expect(decideApproval(await actorOf(gestorB), approval.id, { decision: "APROVAR", opinion: "Invasão de escopo.", consultedDocumentIds: [] }, meta())).rejects.toMatchObject({ status: 404 });
  });
});

describe("documentos", () => {
  it("aceita apenas formatos permitidos pelo conteúdo e guarda hash e versão", async () => {
    const a = await actorOf(gestorA);
    const w = await createWork(a, baseWork(t.a1.id), meta());
    await expect(uploadDocument(a, w.id, { categoryCode: "PROJETO", title: "Executável" } as never, { name: "projeto.pdf", bytes: EXE }, meta())).rejects.toMatchObject({ status: 422 });
    await expect(uploadDocument(a, w.id, { categoryCode: "TREINAMENTO", title: "Sem validade" } as never, { name: "c.pdf", bytes: PDF }, meta())).rejects.toMatchObject({ status: 422 });
    const doc = await uploadDocument(a, w.id, { categoryCode: "PROJETO", title: "Projeto arquitetônico" } as never, { name: "../../etc/passwd.pdf", bytes: PDF }, meta());
    const [d] = await listWorkDocuments(a, w.id);
    expect(d!.versions[0]).toMatchObject({ versionNo: 1, mimeType: "application/pdf", sizeBytes: PDF.length });
    expect(d!.versions[0]!.fileName).not.toContain("/");
    expect(d!.versions[0]!.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(storage.files.has(d!.versions[0]!.storageKey)).toBe(true);

    await addDocumentVersion(a, doc.id, { changeNote: "Revisão do projeto", expiryDate: null }, { name: "v2.png", bytes: PNG }, meta());
    const [d2] = await listWorkDocuments(a, w.id);
    expect(d2!.versions.map((v) => v.versionNo)).toEqual([2, 1]);
    expect(d2!.versions[1]!.supersededAt).not.toBeNull();
    expect(d2!.status).toBe("ENVIADO");
  });

  it("análise com segregação; rejeição exige motivo; download gera token do próprio usuário e auditoria", async () => {
    const a = await actorOf(gestorA);
    const w = await createWork(a, baseWork(t.a1.id), meta());
    const doc = await uploadDocument(a, w.id, { categoryCode: "LAUDO", title: "Laudo estrutural" } as never, { name: "laudo.pdf", bytes: PDF }, meta());
    const reviewer = await actorOf(analista);
    await expect(reviewDocument(reviewer, doc.id, { decision: "REJEITAR", note: "curto" }, meta())).rejects.toMatchObject({ status: 422 });
    await reviewDocument(reviewer, doc.id, { decision: "INICIAR" }, meta());
    const approved = await reviewDocument(reviewer, doc.id, { decision: "APROVAR", note: null }, meta());
    expect(approved.status).toBe("APROVADO");

    const version = await prisma.documentVersion.findFirstOrThrow({ where: { documentId: doc.id } });
    const { url } = await requestDownload(a, doc.id, version.id, meta());
    const payload = verifyDownloadToken(url.split("/").pop()!);
    expect(payload).toMatchObject({ u: gestorA.id, k: version.storageKey });
    expect(await prisma.auditEvent.count({ where: { action: "documento.download", objectId: version.id } })).toBe(1);
    await expect(requestDownload(await actorOf(gestorB), doc.id, version.id, meta())).rejects.toMatchObject({ status: 404 });
  });

  it("documento aprovado com validade expirada passa a vencido", async () => {
    const a = await actorOf(gestorA);
    const w = await createWork(a, baseWork(t.a1.id), meta());
    const doc = await uploadDocument(a, w.id, { categoryCode: "ALVARA", title: "Alvará", expiryDate: new Date("2030-01-01") } as never, { name: "a.pdf", bytes: PDF }, meta());
    await reviewDocument(await actorOf(analista), doc.id, { decision: "APROVAR", note: null }, meta());
    await prisma.document.update({ where: { id: doc.id }, data: { expiryDate: new Date("2020-01-01") } });
    expect(await markExpiredDocuments(prisma, { workId: w.id })).toBe(1);
    expect((await searchDocuments(a, { status: "VENCIDO" })).map((d) => d.id)).toContain(doc.id);
    expect((await searchDocuments(await actorOf(gestorB), {})).map((d) => d.id)).not.toContain(doc.id);
  });
});

describe("requisitos e regras de NR", () => {
  it("regras pendentes de validação aparecem, mas não bloqueiam", async () => {
    const a = await actorOf(gestorA);
    const w = await createWork(a, baseWork(t.a1.id, { activities: ["TRABALHO_ALTURA"] }), meta());
    const reqs = await listWorkRequirements(a, w.id);
    const nr35 = reqs.find((r) => r.rule.code === "NR-35");
    expect(nr35?.rule.status).toBe("PENDENTE_VALIDACAO");
    expect(reqs.find((r) => r.rule.code === "NR-10")).toBeUndefined();
    expect(await blockingIssues(prisma, w.id, "INICIO_EXECUCAO")).toEqual([]);
  });

  it("regra validada e bloqueante impede iniciar execução até ser atendida ou dispensada", async () => {
    const adm = await actorOf(admin);
    const rule = await createRule(
      adm,
      { code: `TESTE-${t.suffix}`, name: "Requisito de teste", workTypes: ["MANUTENCAO"], activities: [], executionModes: [], evidence: "Documento de teste", classification: "INSTITUCIONAL_APROVADO", legalBasis: "Norma interna de teste", checkpoint: "INICIO_EXECUCAO", blocking: true } as never,
      meta(),
    );
    expect(rule.status).toBe("PENDENTE_VALIDACAO");
    await validateRule(adm, rule.id, { lastReviewedAt: new Date("2026-01-01"), nextReviewAt: new Date("2027-01-01"), note: "Validada para teste" }, meta());

    const a = await actorOf(gestorA);
    const w = await createWork(a, baseWork(t.a1.id, { typeCode: "MANUTENCAO", activities: [] }), meta());
    let cur = await transitionWork(a, w.id, { action: "solicitar", version: w.version }, meta());
    cur = await transitionWork(a, w.id, { action: "iniciar_triagem", version: cur.version }, meta());
    cur = await transitionWork(a, w.id, { action: "enviar_aprovacao", version: cur.version }, meta());
    const ap = await prisma.approval.findFirstOrThrow({ where: { workId: w.id } });
    await decideApproval(await actorOf(analista), ap.id, { decision: "APROVAR", opinion: "Aprovado para teste.", consultedDocumentIds: [] }, meta());
    cur = await prisma.work.findUniqueOrThrow({ where: { id: w.id } });

    await expect(transitionWork(a, w.id, { action: "iniciar_execucao", version: cur.version }, meta())).rejects.toMatchObject({ status: 409 });

    const ev = (await listWorkRequirements(a, w.id)).find((r) => r.ruleId === rule.id)!;
    // Quem cadastrou a obra não pode dispensar; o analista pode, com justificativa auditada.
    await expect(waiveEvaluation(a, w.id, ev.id, "Justificativa longa o suficiente aqui.", meta())).rejects.toMatchObject({ status: 403 });
    await waiveEvaluation(await actorOf(analista), w.id, ev.id, "Dispensa justificada por avaliação técnica documentada.", meta());
    expect(await prisma.auditEvent.count({ where: { action: "requisito.dispensado", objectId: ev.id } })).toBe(1);
    const started = await transitionWork(a, w.id, { action: "iniciar_execucao", version: cur.version }, meta());
    expect(started.status).toBe("EM_EXECUCAO");

    // Alterar a regra a devolve para pendente de validação.
    const { updateRule } = await import("@/server/services/requirement.service");
    const changed = await updateRule(adm, rule.id, { evidence: "Outra evidência" }, meta());
    expect(changed.status).toBe("PENDENTE_VALIDACAO");
  });

  it("atendimento por documento vencido não satisfaz requisito bloqueante", async () => {
    const adm = await actorOf(admin);
    const rule = await createRule(
      adm,
      { code: `DOC-${t.suffix}`, name: "Requisito documental", workTypes: ["AMPLIACAO"], activities: [], executionModes: [], evidence: "Alvará", classification: "LEGAL_OBRIGATORIO", legalBasis: "Base de teste", checkpoint: "INICIO_EXECUCAO", blocking: true } as never,
      meta(),
    );
    await validateRule(adm, rule.id, { lastReviewedAt: new Date("2026-01-01"), nextReviewAt: new Date("2027-01-01"), note: "ok" }, meta());
    const a = await actorOf(gestorA);
    const w = await createWork(a, baseWork(t.a1.id, { typeCode: "AMPLIACAO", activities: [] }), meta());
    const doc = await uploadDocument(a, w.id, { categoryCode: "ALVARA", title: "Alvará", expiryDate: new Date("2030-01-01") } as never, { name: "a.pdf", bytes: PDF }, meta());
    await reviewDocument(await actorOf(analista), doc.id, { decision: "APROVAR", note: null }, meta());
    const ev = (await listWorkRequirements(a, w.id)).find((r) => r.ruleId === rule.id)!;
    await setEvaluation(a, w.id, ev.id, { status: "ATENDIDO", documentId: doc.id }, meta());
    expect(await blockingIssues(prisma, w.id, "INICIO_EXECUCAO")).toHaveLength(0);
    await prisma.document.update({ where: { id: doc.id }, data: { status: "VENCIDO" } });
    expect(await blockingIssues(prisma, w.id, "INICIO_EXECUCAO")).toHaveLength(1);
  });
});

describe("relatório", () => {
  it("gera o dossiê em PDF e registra a exportação", async () => {
    const { work } = await workInApproval();
    const { pdf, fileName } = await generateWorkDossier(await actorOf(gestorA), work.id, meta());
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2000);
    expect(fileName).toBe(`dossie-${work.code}.pdf`);
    expect(await prisma.auditEvent.count({ where: { action: "relatorio.dossie.gerado", objectId: work.id } })).toBe(1);
    await expect(generateWorkDossier(await actorOf(gestorB), work.id, meta())).rejects.toMatchObject({ status: 404 });
  });
});
