// =====================================================================
// COMPETENCY_ENGINE (seção 14)
// ---------------------------------------------------------------------
// Cada atividade concluída vira evidência de competência. A soma das
// evidências (com peso) define uma pontuação 0–100, que é traduzida em
// nível 1–6. O gestor pode sobrescrever o nível numa avaliação formal.
// O motor também identifica lacunas contra o alvo da função e indica
// cursos que desenvolvem aquela competência.
// =====================================================================

import type {
  CompetencyEvidenceKind, CompetencyGap, CompetencyLevel, EmployeeCompetency, ID, Recommendation,
} from "../../core/types";
import { catalogRepo, competencyRepo, peopleRepo } from "../../data/repositories";
import { uid } from "../../core/ids";
import { nowIso } from "../../core/dates";

/** Pontuação mínima para cada nível. */
const LEVEL_THRESHOLDS: Array<{ level: CompetencyLevel; min: number }> = [
  { level: 6, min: 96 },
  { level: 5, min: 82 },
  { level: 4, min: 62 },
  { level: 3, min: 38 },
  { level: 2, min: 16 },
  { level: 1, min: 1 },
];

export const LEVEL_NAMES: Record<CompetencyLevel, string> = {
  1: "Conhecimento",
  2: "Básico",
  3: "Operacional",
  4: "Avançado",
  5: "Especialista",
  6: "Mestre",
};

/** Peso padrão de cada tipo de evidência. */
const EVIDENCE_WEIGHT: Record<CompetencyEvidenceKind, number> = {
  aula: 3,
  quiz: 8,
  desafio: 5,
  jogo: 5,
  curso: 18,
  certificado: 10,
  avaliacao_gestor: 30,
  erp: 12,
};

export function levelFromScore(score: number): CompetencyLevel {
  for (const t of LEVEL_THRESHOLDS) if (score >= t.min) return t.level;
  return 1;
}

export const competencyEngine = {
  levelName(level: CompetencyLevel | 0): string {
    return level === 0 ? "Não avaliado" : LEVEL_NAMES[level];
  },

  entry(employeeId: ID, competencyId: ID): EmployeeCompetency | undefined {
    return competencyRepo.entry(employeeId, competencyId);
  },

  levelOf(employeeId: ID, competencyId: ID): CompetencyLevel | 0 {
    return this.entry(employeeId, competencyId)?.level ?? 0;
  },

  /**
   * Registra uma evidência e recalcula o nível.
   * `performance` (0–1) modula o peso: acertar 50% de um quiz vale menos
   * que acertar 100%.
   */
  registerEvidence(
    employeeId: ID,
    competencyId: ID,
    kind: CompetencyEvidenceKind,
    refId: ID,
    label: string,
    performance = 1,
  ): EmployeeCompetency {
    const weight = Math.round(EVIDENCE_WEIGHT[kind] * Math.max(0, Math.min(1, performance)));
    const existing = competencyRepo.entry(employeeId, competencyId);
    const evidence = [
      ...(existing?.evidence ?? []),
      { kind, refId, label, weight, at: nowIso() },
    ];
    // Evidência repetida do mesmo item não soma de novo (conta a melhor).
    const seen = new Map<string, number>();
    for (const e of evidence) {
      const key = `${e.kind}:${e.refId}`;
      seen.set(key, Math.max(seen.get(key) ?? 0, e.weight));
    }
    let score = 0;
    for (const value of seen.values()) score += value;
    score = Math.min(100, score);
    const target = this.targetFor(employeeId, competencyId);

    const entry: EmployeeCompetency = {
      id: existing?.id ?? uid("ECP"),
      employeeId,
      competencyId,
      level: levelFromScore(score),
      targetLevel: target,
      score,
      evidence,
      assessedAt: nowIso(),
      assessedBy: existing?.assessedBy,
    };
    return competencyRepo.saveEntry(entry);
  },

  /** Avaliação manual do gestor/instrutor (prevalece sobre o cálculo). */
  setLevel(employeeId: ID, competencyId: ID, level: CompetencyLevel, assessorId: ID, note = "Avaliação do gestor"): EmployeeCompetency {
    const existing = competencyRepo.entry(employeeId, competencyId);
    const threshold = LEVEL_THRESHOLDS.find((t) => t.level === level)?.min ?? 1;
    const entry: EmployeeCompetency = {
      id: existing?.id ?? uid("ECP"),
      employeeId,
      competencyId,
      level,
      targetLevel: this.targetFor(employeeId, competencyId),
      score: Math.max(existing?.score ?? 0, threshold),
      evidence: [
        ...(existing?.evidence ?? []),
        { kind: "avaliacao_gestor", refId: assessorId, label: note, weight: EVIDENCE_WEIGHT.avaliacao_gestor, at: nowIso() },
      ],
      assessedAt: nowIso(),
      assessedBy: assessorId,
    };
    return competencyRepo.saveEntry(entry);
  },

  targetFor(employeeId: ID, competencyId: ID): CompetencyLevel | undefined {
    const employee = peopleRepo.employee(employeeId);
    if (!employee) return undefined;
    const role = peopleRepo.jobRole(employee.jobRoleId);
    return role?.targets.find((t) => t.competencyId === competencyId)?.level;
  },

  /** Lacunas do colaborador contra o alvo da função. */
  gaps(employeeId: ID): CompetencyGap[] {
    const employee = peopleRepo.employee(employeeId);
    if (!employee) return [];
    const role = peopleRepo.jobRole(employee.jobRoleId);
    if (!role) return [];
    const gaps: CompetencyGap[] = [];
    for (const target of role.targets) {
      const competency = competencyRepo.get(target.competencyId);
      if (!competency) continue;
      const current = this.levelOf(employeeId, target.competencyId);
      const gap = target.level - (current || 0);
      if (gap <= 0) continue;
      gaps.push({
        competencyId: competency.id,
        competencyName: competency.name,
        area: competency.area,
        current,
        target: target.level,
        gap,
        recommendedCourseIds: catalogRepo.coursesOfCompetency(competency.id).map((c) => c.id),
      });
    }
    return gaps.sort((a, b) => b.gap - a.gap);
  },

  /** Mapa completo da matriz para a tela de competências. */
  matrixOf(employeeId: ID) {
    const employee = peopleRepo.employee(employeeId);
    const role = employee ? peopleRepo.jobRole(employee.jobRoleId) : undefined;
    const targets = new Map<ID, CompetencyLevel>((role?.targets ?? []).map((t) => [t.competencyId, t.level]));
    const byArea = new Map<string, Array<{
      competencyId: ID; name: string; level: CompetencyLevel | 0; target?: CompetencyLevel; score: number;
    }>>();
    for (const competency of competencyRepo.all()) {
      const entry = competencyRepo.entry(employeeId, competency.id);
      const target = targets.get(competency.id);
      // Mostra o que é esperado da função + o que a pessoa já desenvolveu.
      if (!target && !entry) continue;
      const list = byArea.get(competency.area) ?? [];
      list.push({
        competencyId: competency.id,
        name: competency.name,
        level: entry?.level ?? 0,
        target,
        score: entry?.score ?? 0,
      });
      byArea.set(competency.area, list);
    }
    return byArea;
  },

  /** Recomendações de curso a partir das lacunas. */
  recommendations(employeeId: ID, limit = 4): Recommendation[] {
    const out: Recommendation[] = [];
    for (const gap of this.gaps(employeeId)) {
      for (const courseId of gap.recommendedCourseIds) {
        const course = catalogRepo.course(courseId);
        if (!course) continue;
        if (out.some((r) => r.refId === courseId)) continue;
        out.push({
          id: `rec-${courseId}`,
          kind: "curso",
          title: course.title,
          reason: `Reforça ${gap.competencyName} (hoje ${this.levelName(gap.current)}, esperado ${this.levelName(gap.target)})`,
          refId: courseId,
          priority: gap.gap,
          link: `/curso/${courseId}`,
        });
      }
    }
    return out.sort((a, b) => b.priority - a.priority).slice(0, limit);
  },
};
