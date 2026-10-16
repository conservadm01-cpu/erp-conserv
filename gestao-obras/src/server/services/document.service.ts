import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma, type Db } from "../db";
import { env } from "../env";
import { recordAudit } from "../audit/audit";
import { assertCanOnWork, can, canOnWork, pathWhere, workScopedWhere, type Actor } from "../authz/authorize";
import type { PermissionCode } from "../authz/catalog";
import { Errors } from "../http/errors";
import type { RequestMeta } from "../http/request-meta";
import { getStorage } from "../storage/storage";
import { ALLOWED_TYPES, sanitizeFileName, sniffFileType } from "../storage/file-type";
import type { DocumentMeta } from "../validation/document";
import { startOfToday } from "./requirement.service";

const auditActor = (a: Actor) => ({ userId: a.userId, email: a.email });

export type UploadedFile = { name: string; bytes: Uint8Array };

function checkFile(file: UploadedFile) {
  const max = env().UPLOAD_MAX_MB * 1024 * 1024;
  if (file.bytes.length === 0) throw Errors.invalid("O arquivo está vazio.", { file: ["Arquivo vazio."] });
  if (file.bytes.length > max) throw Errors.invalid(`O arquivo excede ${env().UPLOAD_MAX_MB} MB.`, { file: ["Arquivo muito grande."] });
  const mime = sniffFileType(file.bytes);
  if (!mime) {
    throw Errors.invalid(`Formato não permitido. Aceitos: ${ALLOWED_TYPES.map((t) => t.label).join(", ")}.`, { file: ["Formato não permitido."] });
  }
  return { mime, fileName: sanitizeFileName(file.name, mime), sha256: createHash("sha256").update(file.bytes).digest("hex") };
}

function storageKey(prefix: string) {
  return `${prefix}/${randomUUID()}`;
}

/** Categorias cujo conteúdo é dado sensível de saúde (acesso restrito). */
export const SENSITIVE_CATEGORIES = ["ASO"];

type DocAccess = { unitPath: string; work: { id: string; unitPath: string } | null; sensitive?: boolean; person?: { userId: string | null } | null };

/**
 * Permissão sobre um documento: pela obra (inclui escopo de obra) ou pela unidade do dono.
 * Documento sensível (ASO) exige a permissão de saúde correspondente; o próprio titular
 * sempre pode consultar e baixar os seus documentos.
 */
export function canOnDocument(actor: Actor, permission: PermissionCode, doc: DocAccess) {
  const isOwner = Boolean(doc.person?.userId && doc.person.userId === actor.userId);
  if (permission === "document.read" && isOwner) return true;
  if (doc.sensitive) return can(actor, permission === "document.read" ? "health.read" : "health.manage", doc.unitPath);
  return doc.work ? canOnWork(actor, permission, doc.work) : can(actor, permission, doc.unitPath);
}

export type DocumentOwner = { kind: "work" | "person" | "company" | "equipment"; id: string };

const ownerInclude = {
  work: { select: { id: true, code: true, title: true } },
  person: { select: { id: true, name: true } },
  company: { select: { id: true, legalName: true } },
  equipment: { select: { id: true, name: true } },
} as const;

/** Rótulo e link do dono, para listagens. */
export function ownerInfo(d: { work: { id: string; code: string; title: string } | null; person: { id: string; name: string } | null; company: { id: string; legalName: string } | null; equipment: { id: string; name: string } | null }) {
  if (d.work) return { label: `${d.work.code} — ${d.work.title}`, href: `/obras/${d.work.id}?aba=documentos`, kind: "Obra" };
  if (d.person) return { label: d.person.name, href: `/pessoas/${d.person.id}`, kind: "Pessoa" };
  if (d.company) return { label: d.company.legalName, href: `/empresas/${d.company.id}`, kind: "Empresa" };
  if (d.equipment) return { label: d.equipment.name, href: `/equipamentos/${d.equipment.id}`, kind: "Equipamento" };
  return { label: "—", href: "#", kind: "—" };
}

async function resolveOwner(actor: Actor, owner: DocumentOwner) {
  const notFound = () => Errors.notFound(owner.kind === "work" ? "Obra" : "Registro");
  if (owner.kind === "work") {
    const work = await prisma.work.findUnique({ where: { id: owner.id } });
    if (!work || !canOnWork(actor, "document.read", work)) throw notFound();
    assertCanOnWork(actor, "document.upload", work, "Você não pode enviar documentos para esta obra.");
    if (work.status === "ARQUIVADA") throw Errors.conflict("Obras arquivadas não recebem documentos.");
    return { unitPath: work.unitPath, link: { workId: work.id }, label: work.code, work };
  }
  const rec =
    owner.kind === "person"
      ? await prisma.person.findUnique({ where: { id: owner.id }, select: { unitPath: true, name: true, status: true } })
      : owner.kind === "company"
        ? await prisma.company.findUnique({ where: { id: owner.id }, select: { unitPath: true, legalName: true, status: true } })
        : await prisma.equipment.findUnique({ where: { id: owner.id }, select: { unitPath: true, name: true, status: true } });
  if (!rec || !can(actor, "document.read", rec.unitPath)) throw notFound();
  if (!can(actor, "document.upload", rec.unitPath)) throw Errors.forbidden("Você não pode enviar documentos para este registro.");
  const label = "name" in rec ? rec.name : "legalName" in rec ? rec.legalName : "";
  const link = owner.kind === "person" ? { personId: owner.id } : owner.kind === "company" ? { companyId: owner.id } : { equipmentId: owner.id };
  return { unitPath: rec.unitPath, link, label, work: null };
}

export async function listOwnerDocuments(actor: Actor, owner: Exclude<DocumentOwner["kind"], "work">, id: string, unitPath: string) {
  if (!can(actor, "document.read", unitPath)) return [];
  const base = owner === "person" ? { personId: id } : owner === "company" ? { companyId: id } : { equipmentId: id };
  const where = can(actor, "health.read", unitPath) ? base : { ...base, sensitive: false };
  await markExpiredDocuments(prisma, where);
  return prisma.document.findMany({ where, include: { category: true, versions: { orderBy: { versionNo: "desc" } } }, orderBy: { createdAt: "asc" } });
}

/** Marca como vencidos os documentos aprovados com validade expirada. Retorna quantos mudaram. */
export async function markExpiredDocuments(db: Db = prisma, filter: Prisma.DocumentWhereInput = {}) {
  const res = await db.document.updateMany({ where: { ...filter, status: "APROVADO", expiryDate: { lt: startOfToday() } }, data: { status: "VENCIDO" } });
  return res.count;
}

async function loadDocument(actor: Actor, id: string) {
  const doc = await prisma.document.findUnique({ where: { id }, include: { work: true, person: { select: { userId: true } } } });
  if (!doc || !canOnDocument(actor, "document.read", doc)) throw Errors.notFound("Documento");
  return doc;
}

export async function listCategories() {
  return prisma.documentCategory.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

export async function listWorkDocuments(actor: Actor, workId: string) {
  const work = await prisma.work.findUnique({ where: { id: workId } });
  if (!work || !canOnWork(actor, "document.read", work)) throw Errors.notFound("Obra");
  await markExpiredDocuments(prisma, { workId });
  return prisma.document.findMany({
    where: { workId },
    include: { category: true, versions: { orderBy: { versionNo: "desc" } } },
    orderBy: [{ categoryCode: "asc" }, { createdAt: "asc" }],
  });
}

/** Busca no repositório documental, restrita ao escopo do ator. */
export async function searchDocuments(actor: Actor, q: { q?: string; status?: Prisma.DocumentWhereInput["status"]; categoryCode?: string; expiring?: "30" }) {
  const scope = workScopedWhere(actor, "document.read", "workId");
  if (!scope) return [];
  // Documentos sensíveis só aparecem na busca para quem tem a permissão de saúde naquela unidade.
  const health = pathWhere(actor, "health.read", "unitPath");
  const sensitiveFilter: Prisma.DocumentWhereInput = health ? { OR: [{ sensitive: false }, health] } : { sensitive: false };
  await markExpiredDocuments(prisma);
  const in30 = new Date(startOfToday().getTime() + 30 * 86_400_000);
  return prisma.document.findMany({
    where: {
      AND: [
        scope,
        sensitiveFilter,
        q.status ? { status: q.status } : {},
        q.categoryCode ? { categoryCode: q.categoryCode } : {},
        q.expiring ? { status: "APROVADO", expiryDate: { gte: startOfToday(), lte: in30 } } : {},
        q.q
          ? { OR: [{ title: { contains: q.q, mode: "insensitive" } }, { documentNumber: { contains: q.q, mode: "insensitive" } }, { work: { code: { contains: q.q, mode: "insensitive" } } }] }
          : {},
      ],
    },
    include: { category: { select: { name: true } }, ...ownerInclude, versions: { where: { supersededAt: null }, select: { versionNo: true } } },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });
}

export async function uploadDocument(actor: Actor, workId: string, metaIn: DocumentMeta, file: UploadedFile, meta: RequestMeta) {
  return uploadOwnedDocument(actor, { kind: "work", id: workId }, metaIn, file, meta);
}

export async function uploadOwnedDocument(actor: Actor, owner: DocumentOwner, metaIn: DocumentMeta, file: UploadedFile, meta: RequestMeta) {
  const target = await resolveOwner(actor, owner);
  if (SENSITIVE_CATEGORIES.includes(metaIn.categoryCode)) {
    if (owner.kind !== "person") throw Errors.invalid("Esta categoria só pode ser usada no cadastro de pessoas.", { categoryCode: ["Categoria inválida."] });
    if (!can(actor, "health.manage", target.unitPath)) throw Errors.forbidden("Você não pode registrar documentos de saúde ocupacional.");
  }
  return storeOwnedDocument(actor, owner, target, metaIn, file, meta);
}

/** Grava arquivo e registro do documento. A autorização é responsabilidade de quem chama. */
export async function storeOwnedDocument(
  actor: Actor,
  owner: DocumentOwner,
  target: { unitPath: string; link: Record<string, string | undefined>; label: string },
  metaIn: DocumentMeta,
  file: UploadedFile,
  meta: RequestMeta,
) {
  const category = await prisma.documentCategory.findUnique({ where: { code: metaIn.categoryCode } });
  if (!category || !category.active) throw Errors.invalid("Categoria inválida.", { categoryCode: ["Selecione uma categoria."] });
  if (category.requiresExpiry && !metaIn.expiryDate) throw Errors.invalid("Esta categoria exige data de validade.", { expiryDate: ["Informe a validade."] });
  const sensitive = SENSITIVE_CATEGORIES.includes(category.code);
  const info = checkFile(file);
  const key = storageKey(`${owner.kind}/${owner.id}`);
  await getStorage().put(key, file.bytes, info.mime);
  try {
    return await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: { ...metaIn, ...target.link, unitPath: target.unitPath, createdById: actor.userId, status: "ENVIADO", sensitive },
      });
      await tx.documentVersion.create({
        data: { documentId: doc.id, versionNo: 1, storageKey: key, fileName: info.fileName, mimeType: info.mime, sizeBytes: file.bytes.length, sha256: info.sha256, uploadedById: actor.userId },
      });
      await recordAudit(
        { action: "documento.enviado", actor: auditActor(actor), objectType: "Document", objectId: doc.id, unitPath: target.unitPath, metadata: { dono: owner.kind, referencia: target.label, titulo: sensitive ? "(documento restrito)" : doc.title, categoria: doc.categoryCode, sha256: info.sha256, bytes: file.bytes.length } },
        meta,
        tx,
      );
      return doc;
    });
  } catch (e) {
    // Sem registro no banco, o arquivo enviado não deve permanecer armazenado.
    await getStorage().delete(key).catch(() => undefined);
    throw e;
  }
}

export async function addDocumentVersion(actor: Actor, documentId: string, input: { changeNote: string; expiryDate: Date | null }, file: UploadedFile, meta: RequestMeta) {
  const doc = await loadDocument(actor, documentId);
  if (!canOnDocument(actor, "document.upload", doc)) throw Errors.forbidden("Você não pode substituir este documento.");
  if (doc.work?.status === "ARQUIVADA") throw Errors.conflict("Obras arquivadas não recebem documentos.");
  const info = checkFile(file);
  const key = storageKey(doc.workId ? `work/${doc.workId}` : `doc/${doc.id}`);
  await getStorage().put(key, file.bytes, info.mime);
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.documentVersion.findFirst({ where: { documentId, supersededAt: null }, orderBy: { versionNo: "desc" } });
      if (current) await tx.documentVersion.update({ where: { id: current.id }, data: { supersededAt: new Date() } });
      const versionNo = (current?.versionNo ?? 0) + 1;
      await tx.documentVersion.create({
        data: { documentId, versionNo, storageKey: key, fileName: info.fileName, mimeType: info.mime, sizeBytes: file.bytes.length, sha256: info.sha256, uploadedById: actor.userId, changeNote: input.changeNote },
      });
      // Nova versão volta para análise.
      const updated = await tx.document.update({
        where: { id: documentId },
        data: { status: "ENVIADO", reviewerNote: null, reviewedAt: null, reviewedById: null, ...(input.expiryDate ? { expiryDate: input.expiryDate } : {}) },
      });
      await recordAudit(
        { action: "documento.substituido", actor: auditActor(actor), objectType: "Document", objectId: documentId, unitPath: doc.unitPath, metadata: { obra: doc.work?.code, versao: versionNo, versaoAnterior: current?.versionNo, motivo: input.changeNote, sha256: info.sha256 } },
        meta,
        tx,
      );
      return updated;
    });
  } catch (e) {
    await getStorage().delete(key).catch(() => undefined);
    throw e;
  }
}

export async function reviewDocument(actor: Actor, documentId: string, input: { decision: "INICIAR" | "APROVAR" | "REJEITAR"; note?: string | null }, meta: RequestMeta) {
  const doc = await loadDocument(actor, documentId);
  if (!canOnDocument(actor, "document.review", doc)) throw Errors.forbidden("Você não pode analisar este documento.");
  const current = await prisma.documentVersion.findFirst({ where: { documentId, supersededAt: null }, orderBy: { versionNo: "desc" } });
  if (current?.uploadedById === actor.userId) throw Errors.forbidden("Por segregação de funções, quem enviou o arquivo não pode analisá-lo.");
  if (input.decision === "INICIAR" && doc.status !== "ENVIADO") throw Errors.conflict("Somente documentos enviados podem entrar em análise.");
  if (input.decision !== "INICIAR" && !["ENVIADO", "EM_REVISAO"].includes(doc.status)) throw Errors.conflict("Este documento não está aguardando análise.");
  if (input.decision === "REJEITAR" && (!input.note || input.note.length < 10)) throw Errors.invalid("Informe o motivo da rejeição (mínimo de 10 caracteres).", { note: ["Motivo obrigatório."] });
  const status = input.decision === "INICIAR" ? "EM_REVISAO" : input.decision === "APROVAR" ? "APROVADO" : "REJEITADO";
  return prisma.$transaction(async (tx) => {
    const changed = await tx.document.updateMany({
      where: { id: documentId, status: doc.status },
      data: { status, ...(input.decision === "INICIAR" ? {} : { reviewerNote: input.note ?? null, reviewedAt: new Date(), reviewedById: actor.userId }) },
    });
    if (changed.count !== 1) throw Errors.conflict("O documento foi alterado por outra pessoa. Recarregue a página.");
    await recordAudit(
      { action: `documento.analise.${input.decision.toLowerCase()}`, actor: auditActor(actor), objectType: "Document", objectId: documentId, unitPath: doc.unitPath, metadata: { obra: doc.work?.code, de: doc.status, para: status, versao: current?.versionNo, parecer: input.note ?? undefined } },
      meta,
      tx,
    );
    if (status === "APROVADO") await markExpiredDocuments(tx, { id: documentId });
    return tx.document.findUniqueOrThrow({ where: { id: documentId } });
  });
}

/** Gera URL temporária para baixar uma versão. O acesso fica registrado na auditoria. */
export async function requestDownload(actor: Actor, documentId: string, versionId: string, meta: RequestMeta) {
  const doc = await loadDocument(actor, documentId);
  const version = await prisma.documentVersion.findFirst({ where: { id: versionId, documentId } });
  if (!version) throw Errors.notFound("Versão");
  const url = await getStorage().downloadUrl({ key: version.storageKey, fileName: version.fileName, mimeType: version.mimeType, userId: actor.userId });
  await recordAudit(
    { action: "documento.download", actor: auditActor(actor), objectType: "DocumentVersion", objectId: version.id, unitPath: doc.unitPath, metadata: { obra: doc.work?.code, documento: doc.title, versao: version.versionNo } },
    meta,
  );
  return { url, expiresInSeconds: env().DOWNLOAD_URL_TTL_SECONDS };
}
