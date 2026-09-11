import { useState } from "react";
import type { Course, GameDefinition, LearningPath, Question } from "../../core/types";
import { auditRepo, catalogRepo, competencyRepo, learningRepo, settingsRepo } from "../../data/repositories";
import { useQuery } from "../../state/useCollection";
import { useAuth } from "../../auth/AuthContext";
import { useRouter } from "../../router/Router";
import { useToast } from "../../state/ToastContext";
import { handbookEngine } from "../../engines/handbook/HandbookEngine";
import { GAME_TYPE_LABELS, gameEngine } from "../../engines/game/GameEngine";
import { PageHeader } from "../../ui/layout/AppShell";
import { Card, SectionTitle } from "../../ui/primitives/Card";
import { Button } from "../../ui/primitives/Button";
import { Chip, StatusChip } from "../../ui/primitives/Chip";
import { Icon } from "../../ui/primitives/Icon";
import { Tabs } from "../../ui/primitives/Tabs";
import { Modal } from "../../ui/primitives/Modal";
import { Field, Select, TextArea, TextInput, Toggle } from "../../ui/primitives/Field";
import { Callout, EmptyState, StatTile } from "../../ui/primitives/Feedback";
import { SourceBadge } from "../../ui/primitives/SourceBadge";
import { formatDate, relativeFrom } from "../../core/dates";
import { cn } from "../../core/cn";

// =====================================================================
// CURSOS
// =====================================================================
export function CoursesAdminPage() {
  const { navigate } = useRouter();
  const courses = useQuery(() => catalogRepo.courses().map((course) => ({
    course,
    lessons: catalogRepo.orderedLessons(course.id).length,
    enrollments: learningRepo.enrollments().filter((e) => e.courseId === course.id).length,
  })));

  return (
    <div>
      <PageHeader
        title="Cursos"
        subtitle="Cursos publicados e rascunhos. Cursos nascem de materiais do Banco de Conhecimento."
        icon="book-open"
        action={<Button icon="plus" onClick={() => navigate("/admin/conteudos")}>Gerar de um conteúdo</Button>}
      />
      <div className="space-y-2.5">
        {courses.map(({ course, lessons, enrollments }) => (
          <Card key={course.id} className="p-4" interactive onClick={() => navigate(`/admin/cursos/${course.id}`)}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-navy text-linen-50">
                <Icon name={course.icon} size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-[15px]">{course.title}</h3>
                  <StatusChip status={course.status} />
                </div>
                <p className="text-[13px] text-ink-600">{course.subtitle}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Chip tone="neutral">{lessons} aulas</Chip>
                <Chip tone="sand">{course.hours}h</Chip>
                <Chip tone="navy">{enrollments} matrícula(s)</Chip>
                <Chip tone="neutral">v{course.version}</Chip>
              </div>
              <Icon name="chevron-right" size={18} className="text-ink-400" />
            </div>
          </Card>
        ))}
        {courses.length === 0 && <EmptyState icon="book-open" title="Nenhum curso ainda" />}
      </div>
    </div>
  );
}

export function CourseAdminDetailPage({ courseId }: { courseId: string }) {
  const { employee } = useAuth();
  const { navigate } = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);

  const data = useQuery(() => {
    const course = catalogRepo.course(courseId);
    if (!course) return null;
    return {
      course,
      modules: catalogRepo.modulesOf(course.id).map((module) => ({ module, lessons: catalogRepo.lessonsOfModule(module.id) })),
      quiz: course.finalQuizId ? catalogRepo.quiz(course.finalQuizId) : undefined,
      enrollments: learningRepo.enrollments().filter((e) => e.courseId === course.id),
      contents: course.sourceContentIds.map((id) => catalogRepo.content(id)).filter(Boolean),
      handbook: course.handbookId ? catalogRepo.handbook(course.handbookId) : catalogRepo.handbooksOfCourse(course.id)[0],
    };
  }, [courseId]);

  if (!data) return <EmptyState icon="book-open" title="Curso não encontrado" />;
  const { course, modules, quiz, enrollments, contents, handbook } = data;

  const setStatus = (status: Course["status"]) => {
    if (!employee) return;
    catalogRepo.patchCourse(course.id, { status, publishedAt: status === "published" ? new Date().toISOString() : course.publishedAt });
    auditRepo.log({ actorId: employee.id, actorName: employee.name, action: `course.${status}`, entity: "courses", entityId: course.id, detail: course.title });
    toast.success(status === "published" ? "Curso publicado" : "Status atualizado");
  };

  return (
    <div>
      <PageHeader
        title={course.title}
        subtitle={`${course.code} · v${course.version} · ${course.hours}h · nota mínima ${course.passScore}%`}
        icon={course.icon}
        back={{ to: "/admin/cursos", label: "Cursos" }}
        action={<StatusChip status={course.status} />}
      />

      <Card className="p-4 mb-5">
        <div className="flex flex-wrap gap-2">
          <Button icon="eye" variant="secondary" onClick={() => navigate(`/curso/${course.id}`)}>Ver como colaborador</Button>
          <Button icon="pen-tool" variant="secondary" onClick={() => setEditing(true)}>Editar dados</Button>
          {course.status !== "published"
            ? <Button icon="check" onClick={() => setStatus("published")}>Publicar</Button>
            : <Button icon="archive" variant="ghost" onClick={() => setStatus("archived")}>Arquivar</Button>}
          <Button
            icon="printer"
            variant="secondary"
            onClick={() => {
              if (!employee) return;
              const generated = handbookEngine.generate({
                courseId: course.id,
                author: employee.name,
                createdBy: employee.id,
                status: "published",
              });
              toast.success("Apostila gerada", generated.title);
              navigate(`/apostila/${generated.id}`);
            }}
          >
            {handbook ? "Gerar nova apostila" : "Gerar apostila"}
          </Button>
        </div>
      </Card>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-5">
        <StatTile label="Matrículas" value={enrollments.length} icon="users" />
        <StatTile label="Concluídos" value={enrollments.filter((e) => e.status === "concluido").length} icon="check-circle" accent="jade" />
        <StatTile label="Aulas" value={modules.reduce((s, m) => s + m.lessons.length, 0)} icon="book-open" />
        <StatTile label="Questões na avaliação" value={quiz?.questionIds.length ?? 0} icon="clipboard" accent="copper" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle>Estrutura</SectionTitle>
          {modules.map(({ module, lessons }) => (
            <div key={module.id} className="mb-3">
              <div className="font-semibold text-[14px]">{module.title}</div>
              <ul className="mt-1 space-y-1">
                {lessons.map((lesson) => (
                  <li key={lesson.id} className="text-[13px] text-ink-600 flex items-center gap-2">
                    <Icon name="play" size={12} />
                    <span className="flex-1 min-w-0 truncate">{lesson.title}</span>
                    <Chip tone="neutral">{lesson.durationMin} min</Chip>
                    {lesson.createdFromContentId && <Chip tone="sand">{lesson.createdFromContentId}</Chip>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionTitle>Origem e referências</SectionTitle>
            <ul className="space-y-1.5 text-[13.5px]">
              {contents.map((content) => (
                <li key={content!.id}>
                  <button type="button" className="text-navy underline" onClick={() => navigate(`/admin/conteudos/${content!.id}`)}>
                    {content!.title}
                  </button>
                  <span className="text-ink-600"> · {content!.id} v{content!.version}</span>
                </li>
              ))}
              {contents.length === 0 && <li className="text-ink-600">Nenhum material vinculado.</li>}
            </ul>
          </Card>
          <Card className="p-4">
            <SectionTitle>Competências</SectionTitle>
            <div className="flex flex-wrap gap-1.5">
              {course.competencies.map((id) => <Chip key={id} tone="navy">{competencyRepo.name(id)}</Chip>)}
            </div>
          </Card>
          <Card className="p-4">
            <SectionTitle>Certificado</SectionTitle>
            <p className="text-[13.5px]">{course.certificate.enabled ? course.certificate.classification : "Não emite certificado"}</p>
            <p className="text-[12.5px] text-ink-600 mt-1">Responsável: {course.certificate.responsible}</p>
          </Card>
        </div>
      </div>

      {editing && (
        <CourseEditModal
          course={course}
          onClose={() => setEditing(false)}
          onSave={(changes) => {
            if (!employee) return;
            catalogRepo.patchCourse(course.id, { ...changes, updatedAt: new Date().toISOString() });
            auditRepo.log({ actorId: employee.id, actorName: employee.name, action: "course.update", entity: "courses", entityId: course.id, detail: course.title });
            setEditing(false);
            toast.success("Curso atualizado");
          }}
        />
      )}
    </div>
  );
}

function CourseEditModal({ course, onClose, onSave }: { course: Course; onClose: () => void; onSave: (changes: Partial<Course>) => void }) {
  const [form, setForm] = useState({
    title: course.title,
    subtitle: course.subtitle,
    description: course.description,
    hours: course.hours,
    passScore: course.passScore,
    level: course.level,
    sector: course.sector,
    certificateEnabled: course.certificate.enabled,
    classification: course.certificate.classification,
    responsible: course.certificate.responsible,
  });
  return (
    <Modal
      open
      onClose={onClose}
      title="Editar curso"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button icon="save" onClick={() => onSave({
            title: form.title,
            subtitle: form.subtitle,
            description: form.description,
            hours: form.hours,
            passScore: form.passScore,
            level: form.level,
            sector: form.sector,
            certificate: { enabled: form.certificateEnabled, classification: form.classification, responsible: form.responsible },
          })}>Salvar</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Título"><TextInput value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
        <Field label="Subtítulo"><TextInput value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} /></Field>
        <Field label="Descrição"><TextArea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Carga horária"><TextInput type="number" min={1} value={form.hours} onChange={(e) => setForm({ ...form, hours: Number(e.target.value) })} /></Field>
          <Field label="Nota mínima (%)"><TextInput type="number" min={0} max={100} value={form.passScore} onChange={(e) => setForm({ ...form, passScore: Number(e.target.value) })} /></Field>
          <Field label="Nível">
            <Select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as Course["level"] })}>
              <option value="basico">Básico</option>
              <option value="intermediario">Intermediário</option>
              <option value="avancado">Avançado</option>
            </Select>
          </Field>
        </div>
        <Toggle checked={form.certificateEnabled} onChange={(certificateEnabled) => setForm({ ...form, certificateEnabled })} label="Emitir certificado" />
        <Field label="Classificação do certificado" hint="Nunca apresentar como certificação oficial sem decisão formal da empresa.">
          <TextInput value={form.classification} onChange={(e) => setForm({ ...form, classification: e.target.value })} />
        </Field>
        <Field label="Responsável"><TextInput value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

// =====================================================================
// QUESTÕES E QUIZZES
// =====================================================================
export function QuizzesAdminPage() {
  const { employee } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState("questoes");
  const [filter, setFilter] = useState("todas");

  const data = useQuery(() => {
    const questions = [...catalogRepo.questions()];
    return {
      questions,
      pending: questions.filter((q) => q.status === "pending_review" || q.status === "draft"),
      approved: questions.filter((q) => q.status === "approved"),
      ai: questions.filter((q) => q.aiGenerated),
      quizzes: [...catalogRepo.quizzes()],
    };
  });

  const list = filter === "pendentes" ? data.pending : filter === "ia" ? data.ai : filter === "aprovadas" ? data.approved : data.questions;

  const setStatus = (question: Question, status: Question["status"]) => {
    if (!employee) return;
    catalogRepo.saveQuestion({ ...question, status, reviewedBy: employee.id, reviewedAt: new Date().toISOString() });
    auditRepo.log({ actorId: employee.id, actorName: employee.name, action: `question.${status}`, entity: "questions", entityId: question.id, detail: question.stem.slice(0, 80) });
    toast.success(status === "approved" ? "Questão aprovada" : "Questão atualizada");
  };

  return (
    <div>
      <PageHeader title="Quizzes e banco de questões" subtitle="Toda questão tem fonte. Questões geradas por IA entram como pendentes." icon="clipboard" />

      <Tabs
        className="mb-4"
        active={tab}
        onChange={setTab}
        items={[
          { id: "questoes", label: "Questões", icon: "help", badge: data.questions.length },
          { id: "quizzes", label: "Quizzes", icon: "clipboard", badge: data.quizzes.length },
        ]}
      />

      {tab === "questoes" && (
        <>
          <Tabs
            className="mb-4"
            active={filter}
            onChange={setFilter}
            items={[
              { id: "todas", label: "Todas", badge: data.questions.length },
              { id: "pendentes", label: "Pendentes", icon: "alert", badge: data.pending.length },
              { id: "aprovadas", label: "Aprovadas", icon: "check", badge: data.approved.length },
              { id: "ia", label: "Geradas por IA", icon: "sparkles", badge: data.ai.length },
            ]}
          />
          <div className="space-y-2.5">
            {list.map((question) => (
              <Card key={question.id} className="p-4">
                <div className="flex flex-wrap items-start gap-2 mb-1.5">
                  <StatusChip status={question.status} />
                  <Chip tone="neutral">{question.difficulty}</Chip>
                  <Chip tone="sand">{question.type.replace(/_/g, " ")}</Chip>
                  <Chip tone="navy">{question.subject}</Chip>
                  {question.aiGenerated && <Chip tone="copper" icon="sparkles">IA</Chip>}
                  <span className="text-[11.5px] text-ink-400 ml-auto">{question.id}</span>
                </div>
                <p className="text-[14.5px] font-semibold leading-snug">{question.stem}</p>
                <ol className="list-[upper-alpha] pl-5 mt-2 space-y-0.5 text-[13.5px]">
                  {question.options.map((option) => (
                    <li key={option.id} className={cn(option.id === question.correctOptionId && "font-semibold text-jade-600")}>
                      {option.text}
                    </li>
                  ))}
                </ol>
                <p className="text-[13px] text-ink-600 mt-2">{question.explanation}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  <SourceBadge sourceRef={question.sourceRef} label="Ver fonte" />
                  {question.status !== "approved" && <Button size="sm" icon="check" onClick={() => setStatus(question, "approved")}>Aprovar</Button>}
                  {question.status === "approved" && <Button size="sm" variant="ghost" icon="archive" onClick={() => setStatus(question, "archived")}>Arquivar</Button>}
                </div>
              </Card>
            ))}
            {list.length === 0 && <EmptyState icon="help" title="Nenhuma questão nesse filtro" />}
          </div>
        </>
      )}

      {tab === "quizzes" && (
        <div className="space-y-2.5">
          {data.quizzes.map((quiz) => (
            <Card key={quiz.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-bold text-[15px] flex-1 min-w-0">{quiz.title}</h3>
                <StatusChip status={quiz.status} />
              </div>
              <p className="text-[13px] text-ink-600 mt-0.5">{quiz.description}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Chip tone="navy">{quiz.scope.replace(/_/g, " ")}</Chip>
                <Chip tone="neutral">{quiz.questionIds.length} questões</Chip>
                {quiz.drawCount > 0 && <Chip tone="sand">sorteia {quiz.drawCount}</Chip>}
                <Chip tone="jade">mínimo {quiz.passScore}%</Chip>
                {quiz.timeLimitSec && <Chip tone="copper">{Math.round(quiz.timeLimitSec / 60)} min</Chip>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// JOGOS
// =====================================================================
export function GamesAdminPage() {
  const { employee } = useAuth();
  const { navigate } = useRouter();
  const toast = useToast();
  const games = useQuery(() => catalogRepo.games());

  const setStatus = (game: GameDefinition, status: GameDefinition["status"]) => {
    if (!employee) return;
    catalogRepo.saveGame({ ...game, status });
    auditRepo.log({ actorId: employee.id, actorName: employee.name, action: `game.${status}`, entity: "games", entityId: game.id, detail: game.title });
    toast.success("Jogo atualizado");
  };

  return (
    <div>
      <PageHeader
        title="Jogos"
        subtitle="O motor trabalha com 4 mecânicas. Criar um jogo novo é criar dado, não código."
        icon="gamepad-2"
      />

      <Card className="p-4 mb-5">
        <SectionTitle>Mecânicas disponíveis</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-2">
          {gameEngine.mechanics().map((mechanic) => (
            <div key={mechanic.mechanic} className="rounded-xl border border-sand/70 p-3">
              <div className="font-semibold text-[13.5px]">{mechanic.label}</div>
              <p className="text-[12.5px] text-ink-600">{mechanic.description}</p>
            </div>
          ))}
        </div>
        <Callout tone="info" title="Jogos de observação">
          “Caça ao Risco” e “Mestre da Qualidade” usam cenas desenhadas (costura, corte, camiseta) com pontos marcados em
          porcentagem. Para uma cena nova, acrescente o desenho em <code>features/games/scenes.tsx</code> e aponte o nome
          dela no jogo — o restante continua sendo dado.
        </Callout>
      </Card>

      <div className="space-y-2.5">
        {games.map((game) => (
          <Card key={game.id} className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-navy text-linen-50">
                <Icon name={game.icon} size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-[15px]">{game.title}</h3>
                  <StatusChip status={game.status} />
                  {game.aiGenerated && <Chip tone="copper" icon="sparkles">gerado</Chip>}
                </div>
                <p className="text-[13px] text-ink-600">{GAME_TYPE_LABELS[game.type]} · {gameEngine.mechanicOf(game).label} · {gameEngine.maxScore(game)} pontos</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" icon="play" onClick={() => navigate(`/jogos/${game.id}`)}>Testar</Button>
                {game.status === "published"
                  ? <Button size="sm" variant="ghost" icon="archive" onClick={() => setStatus(game, "archived")}>Arquivar</Button>
                  : <Button size="sm" icon="check" onClick={() => setStatus(game, "published")}>Publicar</Button>}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// TRILHAS
// =====================================================================
export function PathsAdminPage() {
  const { employee } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState<LearningPath | null>(null);
  const paths = useQuery(() => [...catalogRepo.paths()].sort((a, b) => a.order - b.order));
  const courses = useQuery(() => catalogRepo.courses());

  return (
    <div>
      <PageHeader
        title="Trilhas"
        subtitle="Organizam o caminho de desenvolvimento por função. O administrador pode criar novas trilhas."
        icon="compass"
        action={
          <Button
            icon="plus"
            onClick={() => setEditing({
              id: "",
              code: "",
              title: "",
              description: "",
              order: paths.length + 1,
              icon: "compass",
              accent: "navy",
              courseIds: [],
              competencies: [],
              recommendedFor: ["Todos"],
              mandatory: false,
              status: "draft",
              certificateEnabled: false,
              createdAt: new Date().toISOString(),
            })}
          >
            Nova trilha
          </Button>
        }
      />

      <div className="grid gap-2.5 sm:grid-cols-2">
        {paths.map((path) => (
          <Card key={path.id} className="p-4">
            <div className="flex items-start gap-3">
              <span className="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-navy/10 text-navy border border-navy/20">
                <Icon name={path.icon} size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-[14.5px]">{path.order}. {path.title}</h3>
                  <StatusChip status={path.status} />
                  {path.mandatory && <Chip tone="copper">obrigatória</Chip>}
                </div>
                <p className="text-[12.5px] text-ink-600 mt-0.5 line-clamp-2">{path.description}</p>
                <p className="text-[12px] text-ink-400 mt-1.5">
                  {path.courseIds.length} curso(s) · para {path.recommendedFor.join(", ")}
                </p>
              </div>
              <Button size="sm" variant="ghost" icon="pen-tool" onClick={() => setEditing(path)}>Editar</Button>
            </div>
          </Card>
        ))}
      </div>

      {editing && (
        <Modal
          open
          onClose={() => setEditing(null)}
          title={editing.id ? "Editar trilha" : "Nova trilha"}
          size="lg"
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button
                icon="save"
                disabled={editing.title.trim().length < 3}
                onClick={() => {
                  if (!employee) return;
                  const record: LearningPath = {
                    ...editing,
                    id: editing.id || `PTH-${String(paths.length + 1).padStart(2, "0")}-${Date.now().toString(36).slice(-4)}`,
                    code: editing.code || editing.title.toUpperCase().slice(0, 10).replace(/\s/g, "-"),
                    certificateEnabled: editing.courseIds.length > 0,
                  };
                  catalogRepo.savePath(record);
                  auditRepo.log({ actorId: employee.id, actorName: employee.name, action: editing.id ? "path.update" : "path.create", entity: "learning_paths", entityId: record.id, detail: record.title });
                  setEditing(null);
                  toast.success("Trilha salva");
                }}
              >
                Salvar
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Título" required><TextInput value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} /></Field>
            <Field label="Descrição"><TextArea rows={3} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Ordem"><TextInput type="number" value={editing.order} onChange={(e) => setEditing({ ...editing, order: Number(e.target.value) })} /></Field>
              <Field label="Ícone"><TextInput value={editing.icon} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} /></Field>
              <Field label="Status">
                <Select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as LearningPath["status"] })}>
                  <option value="draft">Rascunho</option>
                  <option value="published">Publicada</option>
                  <option value="archived">Arquivada</option>
                </Select>
              </Field>
            </div>
            <Toggle checked={editing.mandatory} onChange={(mandatory) => setEditing({ ...editing, mandatory })} label="Trilha obrigatória" hint="Aparece como pendência no painel do colaborador." />
            <div>
              <div className="label">Cursos da trilha</div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {courses.map((course) => {
                  const active = editing.courseIds.includes(course.id);
                  return (
                    <button
                      key={course.id}
                      type="button"
                      onClick={() => setEditing({
                        ...editing,
                        courseIds: active ? editing.courseIds.filter((id) => id !== course.id) : [...editing.courseIds, course.id],
                      })}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-xl border text-[13.5px] flex items-center gap-2",
                        active ? "bg-navy/5 border-navy/30" : "bg-linen-50 border-sand",
                      )}
                    >
                      <Icon name={active ? "check-circle" : "circle"} size={15} className={active ? "text-jade-600" : "text-ink-400"} />
                      <span className="flex-1 min-w-0 truncate">{course.title}</span>
                      <StatusChip status={course.status} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// =====================================================================
// APOSTILAS
// =====================================================================
export function HandbooksAdminPage() {
  const { employee } = useAuth();
  const { navigate } = useRouter();
  const toast = useToast();
  const handbooks = useQuery(() => catalogRepo.handbooks());
  const courses = useQuery(() => catalogRepo.publishedCourses());
  const [courseId, setCourseId] = useState("");

  return (
    <div>
      <PageHeader title="Apostilas" subtitle="Gerador de apostilas com capa, sumário, conteúdo, atividades, quiz, gabarito e referências." icon="printer" />

      <Card className="p-4 mb-5">
        <SectionTitle>Gerar apostila de um curso</SectionTitle>
        <div className="flex flex-col sm:flex-row gap-2">
          <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            <option value="">Escolha o curso…</option>
            {courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}
          </Select>
          <Button
            icon="printer"
            disabled={!courseId}
            onClick={() => {
              if (!employee) return;
              const handbook = handbookEngine.generate({ courseId, author: employee.name, createdBy: employee.id, status: "published" });
              auditRepo.log({ actorId: employee.id, actorName: employee.name, action: "handbook.generate", entity: "handbook", entityId: handbook.id, detail: handbook.title });
              toast.success("Apostila gerada", handbook.title);
              navigate(`/apostila/${handbook.id}`);
            }}
          >
            Gerar apostila
          </Button>
        </div>
      </Card>

      <div className="space-y-2.5">
        {handbooks.map((handbook) => (
          <Card key={handbook.id} className="p-4" interactive onClick={() => navigate(`/apostila/${handbook.id}`)}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-navy text-linen-50"><Icon name="book-open" size={19} /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-[15px]">{handbook.title}</h3>
                  <StatusChip status={handbook.status} />
                </div>
                <p className="text-[12.5px] text-ink-600">
                  {handbook.code} · v{handbook.version} · {handbook.hours}h · {handbook.sections.length} seções · {handbook.references.length} referências
                </p>
              </div>
              <span className="text-[12px] text-ink-400">{formatDate(handbook.date)}</span>
            </div>
          </Card>
        ))}
        {handbooks.length === 0 && <EmptyState icon="printer" title="Nenhuma apostila gerada" />}
      </div>
    </div>
  );
}

// =====================================================================
// COMPETÊNCIAS
// =====================================================================
export function CompetenciesAdminPage() {
  const { employee } = useAuth();
  const toast = useToast();
  const competencies = useQuery(() => competencyRepo.byArea());
  const entries = useQuery(() => competencyRepo.all_entries());
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", area: "", description: "", code: "" });

  return (
    <div>
      <PageHeader
        title="Competências"
        subtitle="A matriz da empresa. Níveis: 1 Conhecimento · 2 Básico · 3 Operacional · 4 Avançado · 5 Especialista · 6 Mestre."
        icon="target"
        action={<Button icon="plus" onClick={() => setCreating(true)}>Nova competência</Button>}
      />

      <div className="space-y-5">
        {[...competencies.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([area, items]) => (
          <div key={area}>
            <SectionTitle>{area}</SectionTitle>
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((competency) => {
                const people = entries.filter((e) => e.competencyId === competency.id);
                const avg = people.length === 0 ? 0 : (people.reduce((s, e) => s + e.level, 0) / people.length);
                return (
                  <Card key={competency.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-[14.5px]">{competency.name}</h3>
                      <Chip tone="neutral">{competency.code}</Chip>
                    </div>
                    <p className="text-[12.5px] text-ink-600 mt-1 leading-snug">{competency.description}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Chip tone="navy">{people.length} colaborador(es)</Chip>
                      {people.length > 0 && <Chip tone="sand">média {avg.toFixed(1)}</Chip>}
                      {competency.developedBy.length > 0 && <Chip tone="jade">{competency.developedBy.length} curso(s)</Chip>}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {creating && (
        <Modal
          open
          onClose={() => setCreating(false)}
          title="Nova competência"
          footer={
            <>
              <Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
              <Button
                icon="save"
                disabled={form.name.trim().length < 3 || form.area.trim().length < 2}
                onClick={() => {
                  if (!employee) return;
                  const id = `CMP-${form.name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 18)}`;
                  competencyRepo.save({
                    id,
                    code: form.code || id.replace("CMP-", ""),
                    name: form.name,
                    area: form.area,
                    description: form.description,
                    levelDescriptors: {
                      1: `Sabe o que é ${form.name.toLowerCase()} e por que importa.`,
                      2: `Executa ${form.name.toLowerCase()} em tarefas simples, com acompanhamento.`,
                      3: `Executa ${form.name.toLowerCase()} com autonomia no dia a dia.`,
                      4: `Resolve situações difíceis e orienta colegas.`,
                      5: `É referência: padroniza, treina e melhora o processo.`,
                      6: `Nível mestre: desenvolve métodos e forma multiplicadores.`,
                    },
                    developedBy: [],
                  });
                  auditRepo.log({ actorId: employee.id, actorName: employee.name, action: "competency.create", entity: "competencies", entityId: id, detail: form.name });
                  setCreating(false);
                  setForm({ name: "", area: "", description: "", code: "" });
                  toast.success("Competência criada");
                }}
              >
                Criar
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Nome" required><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field label="Área" required hint="Ex.: Costura, Corte, Qualidade, Segurança"><TextInput value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} /></Field>
            <Field label="Código"><TextInput value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="opcional" /></Field>
            <Field label="Descrição"><TextArea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

// =====================================================================
// NR-1 (visão dedicada, seção 6)
// =====================================================================
export function Nr1AdminPage() {
  const { navigate } = useRouter();
  const settings = useQuery(() => settingsRepo.get());
  const data = useQuery(() => {
    const contents = catalogRepo.contents().filter((c) => c.category === "seguranca" || c.subcategory === "nr-1");
    const courses = catalogRepo.courses().filter((c) => c.category === "seguranca");
    const questions = catalogRepo.questions().filter((q) => q.subject.startsWith("NR-1") || q.competencies.includes("CMP-NR1"));
    const sources = catalogRepo.sources().filter((s) => s.reliability === "oficial");
    const path = catalogRepo.path("PTH-02");
    const challenges = catalogRepo.challenges().filter((c) => c.category === "seguranca");
    return { contents, courses, questions, sources, path, challenges };
  });

  const TOPICS = [
    "conceitos fundamentais", "direitos e deveres", "perigos e riscos", "identificação de perigos",
    "avaliação de riscos", "prevenção", "GRO", "PGR", "inventário de riscos", "plano de ação",
    "participação dos trabalhadores", "comunicação de riscos", "emergência", "acidentes",
    "quase acidentes", "ergonomia", "fatores de risco psicossociais", "organização do trabalho",
    "comunicação", "cultura de segurança",
  ];

  return (
    <div>
      <PageHeader title="NR-1 — Segurança e Saúde no Trabalho" subtitle="Trilha específica, conteúdos, questões e fontes oficiais." icon="shield" />

      <Callout tone="alerta" title="Regra de conformidade">
        {settings.legalDisclaimer} Nunca apresente este material como aconselhamento jurídico nem crie requisito legal
        inexistente. A base normativa deve priorizar fontes oficiais do Ministério do Trabalho e Emprego.
      </Callout>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 my-5">
        <StatTile label="Materiais" value={data.contents.length} icon="file" />
        <StatTile label="Cursos" value={data.courses.length} icon="book-open" />
        <StatTile label="Questões" value={data.questions.length} icon="clipboard" />
        <StatTile label="Fontes oficiais" value={data.sources.length} icon="scroll" accent="jade" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle hint="Temas previstos para a trilha NR-1.">Cobertura de temas</SectionTitle>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {TOPICS.map((topic) => {
              const covered = data.contents.some((c) => (c.rawText ?? "").toLowerCase().includes(topic.split(" ")[0].toLowerCase()))
                || data.questions.some((q) => q.stem.toLowerCase().includes(topic.split(" ")[0].toLowerCase()));
              return (
                <li key={topic} className="flex items-center gap-2 text-[13px]">
                  <Icon name={covered ? "check-circle" : "circle"} size={14} className={covered ? "text-jade-600" : "text-ink-400"} />
                  <span className={covered ? "" : "text-ink-600"}>{topic}</span>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <SectionTitle>Trilha e cursos</SectionTitle>
            {data.path && (
              <Button size="sm" variant="secondary" icon="compass" className="mb-2" onClick={() => navigate(`/trilha/${data.path!.id}`)}>
                {data.path.title}
              </Button>
            )}
            <ul className="space-y-1.5">
              {data.courses.map((course) => (
                <li key={course.id} className="text-[13.5px] flex items-center gap-2">
                  <Icon name="book-open" size={14} className="text-ink-600" />
                  <button type="button" className="text-navy underline flex-1 min-w-0 truncate text-left" onClick={() => navigate(`/admin/cursos/${course.id}`)}>
                    {course.title}
                  </button>
                  <StatusChip status={course.status} />
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-4">
            <SectionTitle>Fontes oficiais vinculadas</SectionTitle>
            <ul className="space-y-2">
              {data.sources.map((source) => (
                <li key={source.id} className="text-[13px]">
                  <strong>{source.name}</strong>
                  <span className="text-ink-600"> · {source.institution}</span>
                  {source.url && <a href={source.url} target="_blank" rel="noreferrer" className="block text-[11.5px] text-navy underline break-all">{source.url}</a>}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-4">
            <SectionTitle>Materiais de NR-1</SectionTitle>
            <ul className="space-y-1.5">
              {data.contents.map((content) => (
                <li key={content.id} className="text-[13.5px] flex items-center gap-2">
                  <button type="button" className="text-navy underline flex-1 min-w-0 truncate text-left" onClick={() => navigate(`/admin/conteudos/${content.id}`)}>
                    {content.title}
                  </button>
                  <span className="text-[11.5px] text-ink-400">{relativeFrom(content.updatedAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
