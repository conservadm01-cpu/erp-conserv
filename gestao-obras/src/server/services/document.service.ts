import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma, type Db } from "../db";
import { env } from "../env";
import { recordAudit } from "../audit/audit";
import { assertCanOnWork, canOnWork, workScopedWhere, type Actor } from "../authz/authorize";
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

function storageKey(workId: string) {
  return `obras/${workId}/${randomUUID()}`;
}

/** Marca como vencidos os documentos aprovados com validade expirada. Retorna quantos mudaram. */
export async function markExpiredDocuments(db: Db = prisma, filter: Prisma.DocumentWhereInput = {}) {
  const res = await db.document.updateMany({ where: { ...filter, status: "APROVADO", expiryDate: { lt: startOfToday() } }, data: { status: "VENCIDO" } });
  return res.count;
}

async function loadDocument(actor: Actor, id: string) {
  const doc = await prisma.document.findUnique({ where: { id }, include: { work: true } });
  if (!doc || !canOnWork(actor, "document.read", doc.work)) throw Errors.notFound("Documento");
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
  await markExpiredDocuments(prisma);
  const in30 = new Date(startOfToday().getTime() + 30 * 86_400_000);
  return prisma.document.findMany({
    where: {
      AND: [
        scope,
        q.status ? { status: q.status } : {},
        q.categoryCode ? { categoryCode: q.categoryCode } : {},
        q.expiring ? { status: "APROVADO", expiryDate: { gte: startOfToday(), lte: in30 } } : {},
        q.q
          ? { OR: [{ title: { contains: q.q, mode: "insensitive" } }, { documentNumber: { contains: q.q, mode: "insensitive" } }, { work: { code: { contains: q.q, mode: "insensitive" } } }] }
          : {},
      ],
    },
    include: { category: { select: { name: true } }, work: { select: { id: true, code: true, title: true } }, versions: { where: { supersededAt: null }, select: { versionNo: true } } },
    orderBy: { updatedAt: "desc" },
    take: 300,
  });
}

export async function uploadDocument(actor: Actor, workId: string, metaIn: DocumentMeta, file: UploadedFile, meta: RequestMeta) {
  const work = await prisma.work.findUnique({ where: { id: workId } });
  if (!work || !canOnWork(actor, "document.read", work)) throw Errors.notFound("Obra");
  assertCanOnWork(actor, "document.upload", work, "Você não pode enviar documentos para esta obra.");
  if (work.status === "ARQUIVADA") throw Errors.conflict("Obras arquivadas não recebem documentos.");
  const category = await prisma.documentCategory.findUnique({ where: { code: metaIn.categoryCode } });
  if (!category || !category.active) throw Errors.invalid("Categoria inválida.", { categoryCode: ["Selecione uma categoria."] });
  if (category.requiresExpiry && !metaIn.expiryDate) throw Errors.invalid("Esta categoria exige data de validade.", { expiryDate: ["Informe a validade."] });
  const info = checkFile(file);
  const key = storageKey(work.id);
  await getStorage().put(key, file.bytes, info.mime);
  try {
    return await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: { ...metaIn, workId: work.id, unitPath: work.unitPath, createdById: actor.userId, status: "ENVIADO" },
      });
      await tx.documentVersion.create({
        data: { documentId: doc.id, versionNo: 1, storageKey: key, fileName: info.fileName, mimeType: info.mime, sizeBytes: file.bytes.length, sha256: info.sha256, uploadedById: actor.userId },
      });
      await recordAudit(
        { action: "documento.enviado", actor: auditActor(actor), objectType: "Document", objectId: doc.id, unitPath: work.unitPath, metadata: { obra: work.code, titulo: doc.title, categoria: doc.categoryCode, sha256: info.sha256, bytes: file.bytes.length } },
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
  assertCanOnWork(actor, "document.upload", doc.work, "Você não pode substituir documentos desta obra.");
  if (doc.work.status === "ARQUIVADA") throw Errors.conflict("Obras arquivadas não recebem documentos.");
  const info = checkFile(file);
  const key = storageKey(doc.workId);
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
        { action: "documento.substituido", actor: auditActor(actor), objectType: "Document", objectId: documentId, unitPath: doc.unitPath, metadata: { obra: doc.work.code, versao: versionNo, versaoAnterior: current?.versionNo, motivo: input.changeNote, sha256: info.sha256 } },
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
  assertCanOnWork(actor, "document.review", doc.work, "Você não pode analisar documentos desta obra.");
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
      { action: `documento.analise.${input.decision.toLowerCase()}`, actor: auditActor(actor), objectType: "Document", objectId: documentId, unitPath: doc.unitPath, metadata: { obra: doc.work.code, de: doc.status, para: status, versao: current?.versionNo, parecer: input.note ?? undefined } },
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
    { action: "documento.download", actor: auditActor(actor), objectType: "DocumentVersion", objectId: version.id, unitPath: doc.unitPath, metadata: { obra: doc.work.code, documento: doc.title, versao: version.versionNo } },
    meta,
  );
  return { url, expiresInSeconds: env().DOWNLOAD_URL_TTL_SECONDS };
}
