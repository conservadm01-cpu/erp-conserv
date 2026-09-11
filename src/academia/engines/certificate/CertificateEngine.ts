// =====================================================================
// CERTIFICATE_ENGINE (seção 13)
// ---------------------------------------------------------------------
// Emite certificado quando o colaborador conclui curso/trilha/avaliação
// com o aproveitamento mínimo. Gera código único e caminho público de
// validação (o QR Code da página aponta para ele).
//
// IMPORTANTE: a classificação é explícita ("certificado de conclusão de
// treinamento interno" por padrão). O motor nunca apresenta o documento
// como certificação oficial ou habilitação legal.
// =====================================================================

import type { Certificate, CertificateKind, ID } from "../../core/types";
import { auditRepo, catalogRepo, certificateRepo, competencyRepo, peopleRepo, settingsRepo } from "../../data/repositories";
import { certificateCode } from "../../core/ids";
import { nowIso } from "../../core/dates";

export interface IssueInput {
  employeeId: ID;
  kind: CertificateKind;
  refId: ID;
  score: number;
  hours?: number;
  title?: string;
  competencies?: ID[];
}

function uniqueCode(): string {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = certificateCode();
    if (!certificateRepo.byCode(code)) return code;
  }
  return `${certificateCode()}-${Date.now().toString(36).toUpperCase()}`;
}

export const certificateEngine = {
  /** Caminho público de validação (usado no QR Code). */
  validationPath(code: string): string {
    return `/validar-certificado/${code}`;
  },

  validationUrl(code: string): string {
    const base = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : "";
    return `${base}#${this.validationPath(code)}`;
  },

  /** Decide se pode emitir: aproveitamento mínimo e certificado habilitado. */
  canIssue(kind: CertificateKind, refId: ID, score: number): { ok: boolean; reason?: string; minScore: number } {
    const settings = settingsRepo.get();
    if (kind === "curso") {
      const course = catalogRepo.course(refId);
      if (!course) return { ok: false, reason: "Curso não encontrado", minScore: settings.defaultPassScore };
      if (!course.certificate.enabled) return { ok: false, reason: "Curso sem certificado habilitado", minScore: course.passScore };
      return { ok: score >= course.passScore, reason: score >= course.passScore ? undefined : "Aproveitamento abaixo do mínimo", minScore: course.passScore };
    }
    if (kind === "trilha") {
      const path = catalogRepo.path(refId);
      if (!path) return { ok: false, reason: "Trilha não encontrada", minScore: settings.defaultPassScore };
      if (!path.certificateEnabled) return { ok: false, reason: "Trilha sem certificado habilitado", minScore: settings.defaultPassScore };
      return { ok: score >= settings.defaultPassScore, minScore: settings.defaultPassScore };
    }
    return { ok: score >= settings.defaultPassScore, minScore: settings.defaultPassScore };
  },

  issue(input: IssueInput): Certificate | null {
    const employee = peopleRepo.employee(input.employeeId);
    if (!employee) return null;
    const permission = this.canIssue(input.kind, input.refId, input.score);
    if (!permission.ok) return null;

    const existing = certificateRepo.existing(input.employeeId, input.kind, input.refId);
    if (existing) return existing;

    const settings = settingsRepo.get();
    const course = input.kind === "curso" ? catalogRepo.course(input.refId) : undefined;
    const path = input.kind === "trilha" ? catalogRepo.path(input.refId) : undefined;
    const hours = input.hours ?? course?.hours ?? (path ? path.courseIds.reduce((sum, id) => sum + (catalogRepo.course(id)?.hours ?? 0), 0) : 0);
    const title = input.title ?? course?.title ?? path?.title ?? "Treinamento interno";
    const competencies = input.competencies ?? course?.competencies ?? path?.competencies ?? [];
    const code = uniqueCode();

    const certificate = certificateRepo.save({
      id: `CERT-${code}`,
      code,
      kind: input.kind,
      refId: input.refId,
      employeeId: employee.id,
      employeeName: employee.name,
      employeeCode: employee.code,
      title,
      hours,
      score: input.score,
      issuedAt: nowIso(),
      responsible: course?.certificate.responsible ?? settings.certificateResponsible,
      classification: course?.certificate.classification ?? settings.certificateClassification,
      status: "valido",
      validationPath: this.validationPath(code),
      competencies,
      librarySourceIds: course?.librarySourceIds ?? [],
    });

    auditRepo.log({
      actorId: employee.id,
      actorName: employee.name,
      action: "certificate.issue",
      entity: "certificates",
      entityId: certificate.id,
      detail: `${title} · ${employee.name} · ${input.score}% · ${hours}h`,
    });

    return certificate;
  },

  /** Validação pública — registra a consulta para auditoria. */
  validate(code: string): { certificate: Certificate | null; result: "valido" | "nao_encontrado" | "revogado" | "expirado" } {
    const certificate = certificateRepo.byCode(code);
    let result: "valido" | "nao_encontrado" | "revogado" | "expirado" = "nao_encontrado";
    if (certificate) {
      if (certificate.status === "revogado") result = "revogado";
      else if (certificate.validUntil && Date.parse(certificate.validUntil) < Date.now()) result = "expirado";
      else result = "valido";
    }
    certificateRepo.logValidation({
      id: `CVL-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      code: code.trim().toUpperCase(),
      at: nowIso(),
      result,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 180) : undefined,
    });
    return { certificate: certificate ?? null, result };
  },

  revoke(certificateId: ID, reason: string): Certificate | undefined {
    const certificate = certificateRepo.get(certificateId);
    if (!certificate) return undefined;
    auditRepo.log({
      actorId: certificate.employeeId,
      actorName: certificate.employeeName,
      action: "certificate.revoke",
      entity: "certificates",
      entityId: certificate.id,
      detail: `${certificate.code}: ${reason}`,
    });
    return certificateRepo.save({ ...certificate, status: "revogado", revokedReason: reason });
  },

  competencyNames(certificate: Certificate): string[] {
    return certificate.competencies.map((id) => competencyRepo.name(id));
  },
};
