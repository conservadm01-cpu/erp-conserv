// =====================================================================
// CONTROLE DE PERMISSÕES (seção 30)
// ---------------------------------------------------------------------
// ADMIN       — tudo: conteúdo, cursos, pessoas, configurações
// GESTOR      — pessoas da sua equipe, competências, riscos, relatórios
// INSTRUTOR   — conteúdo e cursos (criar/editar), aprovar questões
// COLABORADOR — apenas consumir conteúdo publicado
//
// Regra de ouro: colaborador nunca altera conteúdo oficial.
// =====================================================================

import type { Role } from "../core/types";

export type Permission =
  | "content.create" | "content.edit" | "content.publish" | "content.delete"
  | "course.create" | "course.edit" | "course.publish"
  | "question.review" | "game.manage" | "handbook.generate"
  | "people.view" | "people.edit" | "competency.assess"
  | "certificate.issue" | "certificate.revoke"
  | "risk.view" | "risk.manage"
  | "report.view" | "settings.edit" | "audit.view" | "admin.access";

const MATRIX: Record<Role, Permission[]> = {
  ADMIN: [
    "content.create", "content.edit", "content.publish", "content.delete",
    "course.create", "course.edit", "course.publish",
    "question.review", "game.manage", "handbook.generate",
    "people.view", "people.edit", "competency.assess",
    "certificate.issue", "certificate.revoke",
    "risk.view", "risk.manage",
    "report.view", "settings.edit", "audit.view", "admin.access",
  ],
  GESTOR: [
    "content.create", "content.edit",
    "people.view", "competency.assess",
    "certificate.issue",
    "risk.view", "risk.manage",
    "report.view", "audit.view", "admin.access",
    "handbook.generate",
  ],
  INSTRUTOR: [
    "content.create", "content.edit", "content.publish",
    "course.create", "course.edit", "course.publish",
    "question.review", "game.manage", "handbook.generate",
    "people.view", "competency.assess", "report.view", "admin.access",
  ],
  COLABORADOR: [],
};

export function can(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;
  return MATRIX[role].includes(permission);
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  GESTOR: "Gestor",
  INSTRUTOR: "Instrutor",
  COLABORADOR: "Colaborador",
};

export function permissionsOf(role: Role): Permission[] {
  return [...MATRIX[role]];
}
