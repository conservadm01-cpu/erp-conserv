import { db } from "../db";
import type { AuditLog, Certificate, CertificateValidation, ID, Notification, RiskReport } from "../../core/types";
import { uid } from "../../core/ids";
import { nowIso } from "../../core/dates";

export const certificateRepo = {
  all(): readonly Certificate[] {
    return db.list("certificates");
  },
  get(id?: ID): Certificate | undefined {
    return db.byId("certificates", id);
  },
  byCode(code: string): Certificate | undefined {
    const target = code.trim().toUpperCase();
    return db.find("certificates", (c) => c.code.toUpperCase() === target);
  },
  ofEmployee(employeeId: ID): Certificate[] {
    return db.filter("certificates", (c) => c.employeeId === employeeId).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  },
  existing(employeeId: ID, kind: Certificate["kind"], refId: ID): Certificate | undefined {
    return db.find("certificates", (c) => c.employeeId === employeeId && c.kind === kind && c.refId === refId && c.status === "valido");
  },
  save(certificate: Certificate): Certificate {
    return db.put("certificates", certificate);
  },
  logValidation(record: CertificateValidation): CertificateValidation {
    return db.put("certificate_validations", record);
  },
  validations(code?: string): CertificateValidation[] {
    return code ? db.filter("certificate_validations", (v) => v.code === code) : [...db.list("certificate_validations")];
  },
};

export const riskRepo = {
  all(): readonly RiskReport[] {
    return db.list("risk_reports");
  },
  get(id?: ID): RiskReport | undefined {
    return db.byId("risk_reports", id);
  },
  ofEmployee(employeeId: ID): RiskReport[] {
    return db.filter("risk_reports", (r) => r.employeeId === employeeId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  open(): RiskReport[] {
    return db.filter("risk_reports", (r) => r.status !== "encerrado" && r.status !== "resolvido");
  },
  save(report: RiskReport): RiskReport {
    return db.put("risk_reports", report);
  },
  nextSequence(): number {
    return db.count("risk_reports") + 1;
  },
};

export const notificationRepo = {
  all(): readonly Notification[] {
    return db.list("notifications");
  },
  forEmployee(employeeId: ID, role?: string): Notification[] {
    return db.filter("notifications", (n) => n.employeeId === employeeId || (!!role && n.role === role))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
  unreadCount(employeeId: ID, role?: string): number {
    return this.forEmployee(employeeId, role).filter((n) => !n.read).length;
  },
  save(notification: Notification): Notification {
    return db.put("notifications", notification);
  },
  markRead(id: ID): void {
    db.patch("notifications", id, { read: true });
  },
  markAllRead(employeeId: ID): void {
    for (const n of this.forEmployee(employeeId)) if (!n.read) db.patch("notifications", n.id, { read: true });
  },
};

export const auditRepo = {
  all(): readonly AuditLog[] {
    return db.list("audit_logs");
  },
  recent(limit = 100): AuditLog[] {
    return [...db.list("audit_logs")].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
  },
  log(entry: Omit<AuditLog, "id" | "at">): AuditLog {
    return db.put("audit_logs", { ...entry, id: uid("LOG"), at: nowIso() });
  },
  ofEntity(entity: string, entityId: ID): AuditLog[] {
    return db.filter("audit_logs", (l) => l.entity === entity && l.entityId === entityId)
      .sort((a, b) => b.at.localeCompare(a.at));
  },
};
