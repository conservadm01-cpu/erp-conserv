import { useState } from "react";
import type { CompetencyLevel } from "../../core/types";
import { catalogRepo, certificateRepo, competencyRepo, learningRepo, peopleRepo } from "../../data/repositories";
import { useQuery } from "../../state/useCollection";
import { useAuth } from "../../auth/AuthContext";
import { useToast } from "../../state/ToastContext";
import { useRouter } from "../../router/Router";
import { competencyEngine, LEVEL_NAMES } from "../../engines/competency/CompetencyEngine";
import { progressEngine } from "../../engines/learning/ProgressEngine";
import { xpEngine } from "../../engines/gamification/XpEngine";
import { auditRepo } from "../../data/repositories";
import { PageHeader } from "../../ui/layout/AppShell";
import { Card, SectionTitle } from "../../ui/primitives/Card";
import { Button } from "../../ui/primitives/Button";
import { Chip, StatusChip } from "../../ui/primitives/Chip";
import { Icon } from "../../ui/primitives/Icon";
import { Avatar } from "../../ui/primitives/Avatar";
import { TextInput, Select } from "../../ui/primitives/Field";
import { LevelMeter, ProgressBar } from "../../ui/primitives/Progress";
import { EmptyState, StatTile } from "../../ui/primitives/Feedback";
import { formatDate } from "../../core/dates";

export function EmployeesPage() {
  const { navigate } = useRouter();
  const [term, setTerm] = useState("");
  const employees = useQuery(() => peopleRepo.searchEmployees(term), [term]);

  return (
    <div>
      <PageHeader
        title="Colaboradores"
        subtitle="Quem está se desenvolvendo, em quê e o que falta."
        icon="users"
      />
      <TextInput className="mb-4 sm:max-w-md" aria-label="Buscar colaborador" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar por nome, matrícula ou cargo…" />

      <div className="space-y-2.5">
        {employees.map((employee) => {
          const level = xpEngine.level(employee.id);
          const enrollments = learningRepo.enrollmentsOf(employee.id);
          const done = enrollments.filter((e) => e.status === "concluido").length;
          const gaps = competencyEngine.gaps(employee.id);
          return (
            <Card key={employee.id} className="p-4" interactive onClick={() => navigate(`/admin/colaboradores/${employee.id}`)}>
              <div className="flex flex-wrap items-center gap-3">
                <Avatar name={employee.name} photoUrl={employee.photoUrl} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-[15px]">{employee.name}</h3>
                    <Chip tone="neutral">{employee.code}</Chip>
                    {employee.status !== "ativo" && <StatusChip status={employee.status} />}
                  </div>
                  <p className="text-[13px] text-ink-600">
                    {employee.cargo} · {peopleRepo.departmentName(employee.departmentId)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Chip tone="copper" icon="zap">{level.xp} XP</Chip>
                  <Chip tone="navy">Nível {level.level}</Chip>
                  <Chip tone="jade">{done} curso(s)</Chip>
                  {gaps.length > 0 && <Chip tone="alert">{gaps.length} lacuna(s)</Chip>}
                </div>
                <Icon name="chevron-right" size={18} className="text-ink-400 shrink-0" />
              </div>
            </Card>
          );
        })}
        {employees.length === 0 && <EmptyState icon="users" title="Ninguém encontrado" />}
      </div>
    </div>
  );
}

export function EmployeeDetailPage({ employeeId }: { employeeId: string }) {
  const { employee: actor, can } = useAuth();
  const toast = useToast();
  const { navigate } = useRouter();
  const [assigning, setAssigning] = useState("");

  const data = useQuery(() => {
    const employee = peopleRepo.employee(employeeId);
    if (!employee) return null;
    return {
      employee,
      level: xpEngine.level(employee.id),
      role: peopleRepo.jobRole(employee.jobRoleId),
      department: peopleRepo.departmentName(employee.departmentId),
      supervisor: employee.supervisorId ? peopleRepo.employee(employee.supervisorId) : undefined,
      enrollments: learningRepo.enrollmentsOf(employee.id).map((e) => ({ enrollment: e, course: catalogRepo.course(e.courseId) })),
      certificates: certificateRepo.ofEmployee(employee.id),
      matrix: competencyEngine.matrixOf(employee.id),
      gaps: competencyEngine.gaps(employee.id),
      attempts: learningRepo.quizAttempts(employee.id),
      courses: catalogRepo.publishedCourses(),
      lessonsDone: learningRepo.progressOf(employee.id).filter((p) => p.status === "concluido").length,
    };
  }, [employeeId]);

  if (!data) return <EmptyState icon="users" title="Colaborador não encontrado" />;
  const { employee, level, role, department, supervisor, enrollments, certificates, matrix, gaps, attempts, courses, lessonsDone } = data;
  const avg = attempts.length === 0 ? 0 : Math.round(attempts.reduce((s, a) => s + a.score, 0) / attempts.length);

  const assess = (competencyId: string, newLevel: CompetencyLevel) => {
    if (!actor) return;
    competencyEngine.setLevel(employee.id, competencyId, newLevel, actor.id, `Avaliação de ${actor.name}`);
    auditRepo.log({
      actorId: actor.id,
      actorName: actor.name,
      action: "competency.assess",
      entity: "employee_competencies",
      entityId: employee.id,
      detail: `${competencyRepo.name(competencyId)} → nível ${newLevel} (${employee.name})`,
    });
    toast.success("Competência avaliada", `${competencyRepo.name(competencyId)}: ${LEVEL_NAMES[newLevel]}`);
  };

  return (
    <div>
      <PageHeader
        title={employee.name}
        subtitle={`${employee.cargo} · ${department} · matrícula ${employee.code}`}
        icon="user"
        back={{ to: "/admin/colaboradores", label: "Colaboradores" }}
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-5">
        <StatTile label="XP / Nível" value={`${level.xp}`} hint={`Nível ${level.level} · ${level.name}`} icon="zap" accent="copper" />
        <StatTile label="Aulas concluídas" value={lessonsDone} icon="book-open" />
        <StatTile label="Média nos quizzes" value={`${avg}%`} icon="clipboard" accent="jade" />
        <StatTile label="Certificados" value={certificates.length} icon="award" accent="sand" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle>Dados do colaborador</SectionTitle>
          <ul className="space-y-1.5 text-[13.5px]">
            <li><span className="text-ink-600">Função:</span> <strong>{role?.name ?? "—"}</strong></li>
            <li><span className="text-ink-600">Setor:</span> <strong>{department}</strong></li>
            <li><span className="text-ink-600">Admissão:</span> <strong>{formatDate(employee.admissionDate)}</strong></li>
            <li><span className="text-ink-600">Supervisor:</span> <strong>{supervisor?.name ?? "—"}</strong></li>
            <li><span className="text-ink-600">Nível profissional:</span> <strong>{employee.professionalLevel}</strong></li>
            <li><span className="text-ink-600">Turno:</span> <strong>{employee.shift ?? "—"}</strong></li>
            <li><span className="text-ink-600">Ranking:</span> <strong>{employee.preferences.rankingOptIn ? "participa" : "não participa"}</strong></li>
          </ul>
          <p className="text-[11.5px] text-ink-400 mt-3">
            Dados sensíveis (documentos, salário, saúde) não são armazenados nem exibidos aqui.
          </p>
        </Card>

        <Card className="p-4">
          <SectionTitle hint="Matricular em um curso publicado.">Matrículas</SectionTitle>
          <div className="flex gap-2 mb-3">
            <Select value={assigning} aria-label="Curso para matricular o colaborador" onChange={(e) => setAssigning(e.target.value)}>
              <option value="">Escolha um curso…</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
            </Select>
            <Button
              icon="plus"
              disabled={!assigning || (!can("people.edit") && !can("competency.assess"))}
              onClick={() => {
                progressEngine.enroll(employee.id, assigning, "gestor");
                toast.success("Colaborador matriculado");
                setAssigning("");
              }}
            >
              Matricular
            </Button>
          </div>
          <ul className="space-y-2">
            {enrollments.map(({ enrollment, course }) => (
              <li key={enrollment.id} className="rounded-xl border border-sand/70 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[13.5px] flex-1 min-w-0 truncate">{course?.title ?? enrollment.courseId}</span>
                  <StatusChip status={enrollment.status} />
                </div>
                <div className="mt-2"><ProgressBar value={enrollment.progressPct} size="sm" showValue /></div>
                {enrollment.finalScore !== undefined && (
                  <p className="text-[12px] text-ink-600 mt-1">Nota final: {enrollment.finalScore}%</p>
                )}
              </li>
            ))}
            {enrollments.length === 0 && <li className="text-[13.5px] text-ink-600">Nenhuma matrícula.</li>}
          </ul>
        </Card>
      </div>

      {gaps.length > 0 && (
        <Card className="p-4 mt-4 border-copper/30 bg-copper/5">
          <SectionTitle hint="Diferença entre o nível atual e o esperado para a função.">Lacunas de competência</SectionTitle>
          <ul className="space-y-2">
            {gaps.map((gap) => (
              <li key={gap.competencyId} className="flex flex-wrap items-center gap-3 p-2.5 rounded-xl bg-linen-50 border border-sand/70">
                <span className="text-[14px] font-semibold flex-1 min-w-0">{gap.competencyName}</span>
                <span className="text-[12.5px] text-ink-600">
                  {competencyEngine.levelName(gap.current)} → {competencyEngine.levelName(gap.target)}
                </span>
                <LevelMeter level={gap.current || 0} target={gap.target} size="sm" />
                {gap.recommendedCourseIds[0] && (
                  <Button
                    size="sm"
                    variant="copper"
                    icon="plus"
                    onClick={() => {
                      progressEngine.enroll(employee.id, gap.recommendedCourseIds[0], "gestor");
                      toast.success("Curso recomendado atribuído");
                    }}
                  >
                    Matricular no curso
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-4 mt-4">
        <SectionTitle hint="A avaliação do gestor prevalece sobre o cálculo automático.">Matriz de competências</SectionTitle>
        {[...matrix.entries()].map(([area, items]) => (
          <div key={area} className="mb-4">
            <div className="label">{area}</div>
            <ul className="space-y-2">
              {items.map((item) => (
                <li key={item.competencyId} className="flex flex-wrap items-center gap-3">
                  <span className="text-[13.5px] flex-1 min-w-0 truncate">{item.name}</span>
                  <LevelMeter level={item.level} target={item.target} size="sm" />
                  {can("competency.assess") && (
                    <Select
                      className="w-[150px] shrink-0"
                      aria-label={`Avaliar nível de ${item.name}`}
                      value={String(item.level || "")}
                      onChange={(e) => assess(item.competencyId, Number(e.target.value) as CompetencyLevel)}
                    >
                      <option value="">avaliar…</option>
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n} value={n}>{n} · {LEVEL_NAMES[n as CompetencyLevel]}</option>
                      ))}
                    </Select>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>

      {certificates.length > 0 && (
        <Card className="p-4 mt-4">
          <SectionTitle>Certificados</SectionTitle>
          <ul className="space-y-2">
            {certificates.map((certificate) => (
              <li key={certificate.id} className="flex flex-wrap items-center gap-2 text-[13.5px]">
                <Icon name="award" size={15} className="text-copper shrink-0" />
                <span className="flex-1 min-w-0 truncate">{certificate.title}</span>
                <Chip tone="neutral">{certificate.code}</Chip>
                <Chip tone="sand">{certificate.score}%</Chip>
                <Button size="sm" variant="ghost" onClick={() => navigate(`/certificado/${certificate.code}`)}>abrir</Button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
