import { catalogRepo, learningRepo, peopleRepo } from "../../data/repositories";
import { useQuery } from "../../state/useCollection";
import { useAuth } from "../../auth/AuthContext";
import { useRouter } from "../../router/Router";
import { PageHeader } from "../../ui/layout/AppShell";
import { Card, accentClasses } from "../../ui/primitives/Card";
import { Chip } from "../../ui/primitives/Chip";
import { Icon } from "../../ui/primitives/Icon";
import { ProgressBar } from "../../ui/primitives/Progress";
import { Button } from "../../ui/primitives/Button";
import { EmptyState } from "../../ui/primitives/Feedback";
import { cn } from "../../core/cn";
import { competencyRepo } from "../../data/repositories";
import { BlockList } from "../../ui/content/BlockRenderer";

export function TrailsPage() {
  const { employee } = useAuth();
  const { navigate } = useRouter();

  const trails = useQuery(() => {
    const roleName = employee ? peopleRepo.jobRoleName(employee.jobRoleId) : "";
    return catalogRepo.publishedPaths().map((path) => {
      const courses = path.courseIds.map((id) => catalogRepo.course(id)).filter((c): c is NonNullable<typeof c> => !!c);
      const enrollments = employee ? courses.map((c) => learningRepo.enrollment(employee.id, c.id)) : [];
      const progressValues = enrollments.map((e) => e?.progressPct ?? 0);
      const progress = progressValues.length > 0 ? Math.round(progressValues.reduce((a, b) => a + b, 0) / progressValues.length) : 0;
      const hours = courses.reduce((sum, c) => sum + c.hours, 0);
      const forMe = path.recommendedFor.includes("Todos") || path.recommendedFor.includes(roleName);
      return { path, courses, progress, hours, forMe };
    });
  }, [employee?.id]);

  const mine = trails.filter((t) => t.forMe && t.courses.length > 0);
  const others = trails.filter((t) => !t.forMe || t.courses.length === 0);

  return (
    <div>
      <PageHeader
        title="Trilhas de aprendizagem"
        subtitle="Cada trilha é um caminho de desenvolvimento. Comece pelas recomendadas para a sua função."
        icon="compass"
      />

      <section className="mb-8">
        <h2 className="text-[15px] font-bold mb-3 flex items-center gap-2">
          <Icon name="star" size={16} className="text-copper" />
          Para você
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {mine.map(({ path, courses, progress, hours }) => (
            <Card key={path.id} className="p-4 flex flex-col" interactive onClick={() => navigate(`/trilha/${path.id}`)}>
              <div className="flex items-start gap-3">
                <span className={cn("shrink-0 grid place-items-center w-11 h-11 rounded-xl border", accentClasses(path.accent))}>
                  <Icon name={path.icon} size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    {path.mandatory && <Chip tone="copper">Obrigatória</Chip>}
                    <Chip tone="neutral">{courses.length} curso{courses.length === 1 ? "" : "s"}</Chip>
                    {hours > 0 && <Chip tone="sand">{hours}h</Chip>}
                  </div>
                  <h3 className="font-bold text-[15px] leading-snug">{path.title}</h3>
                </div>
              </div>
              <p className="text-[13px] text-ink-600 mt-2.5 leading-snug line-clamp-2 flex-1">{path.description}</p>
              <div className="mt-3">
                <ProgressBar value={progress} showValue label="Seu progresso" />
              </div>
            </Card>
          ))}
        </div>
        {mine.length === 0 && <EmptyState icon="compass" title="Nenhuma trilha publicada para sua função ainda" description="Fale com a coordenação de treinamento ou explore as outras trilhas." />}
      </section>

      <section>
        <h2 className="text-[15px] font-bold mb-3 flex items-center gap-2">
          <Icon name="layers" size={16} className="text-ink-600" />
          Todas as trilhas
        </h2>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {others.map(({ path, courses, hours }) => (
            <Card
              key={path.id}
              className={cn("p-3.5 flex items-center gap-3", courses.length === 0 && "opacity-80")}
              interactive={courses.length > 0}
              onClick={courses.length > 0 ? () => navigate(`/trilha/${path.id}`) : undefined}
            >
              <span className={cn("shrink-0 grid place-items-center w-10 h-10 rounded-xl border", accentClasses(path.accent))}>
                <Icon name={path.icon} size={19} />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-[14px] leading-snug truncate">{path.title}</h3>
                <p className="text-[12px] text-ink-600">
                  {courses.length > 0 ? `${courses.length} curso(s) · ${hours}h` : "Em construção — conteúdo a caminho"}
                </p>
              </div>
              {courses.length > 0
                ? <Icon name="chevron-right" size={18} className="text-ink-400 shrink-0" />
                : <Chip tone="neutral">Em breve</Chip>}
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

export function TrailDetailPage({ pathId }: { pathId: string }) {
  const { employee } = useAuth();
  const { navigate } = useRouter();

  const data = useQuery(() => {
    const path = catalogRepo.path(pathId);
    if (!path) return null;
    const courses = path.courseIds.map((id) => {
      const course = catalogRepo.course(id);
      if (!course) return null;
      const enrollment = employee ? learningRepo.enrollment(employee.id, id) : undefined;
      const lessons = catalogRepo.orderedLessons(id);
      return { course, enrollment, lessons };
    }).filter((c): c is NonNullable<typeof c> => !!c);
    return { path, courses };
  }, [pathId, employee?.id]);

  if (!data) return <EmptyState icon="compass" title="Trilha não encontrada" />;
  const { path, courses } = data;

  return (
    <div>
      <PageHeader
        title={path.title}
        subtitle={path.description}
        icon={path.icon}
        back={{ to: "/trilhas", label: "Todas as trilhas" }}
      />

      <div className="flex flex-wrap gap-2 mb-5">
        {path.mandatory && <Chip tone="copper" icon="alert">Trilha obrigatória</Chip>}
        <Chip tone="neutral" icon="book-open">{courses.length} curso(s)</Chip>
        <Chip tone="sand" icon="clock">{courses.reduce((s, c) => s + c.course.hours, 0)}h</Chip>
        {path.certificateEnabled && <Chip tone="jade" icon="award">Gera certificado</Chip>}
      </div>

      {path.competencies.length > 0 && (
        <Card className="p-4 mb-5">
          <div className="label">Competências desenvolvidas</div>
          <div className="flex flex-wrap gap-1.5">
            {path.competencies.map((id) => (
              <Chip key={id} tone="navy">{competencyRepo.name(id)}</Chip>
            ))}
          </div>
        </Card>
      )}

      {courses.length === 0 ? (
        <EmptyState
          icon="upload"
          title="Trilha em construção"
          description="Ainda não há curso publicado nesta trilha. Quando a coordenação enviar o material para o Banco de Conhecimento, o curso aparece aqui automaticamente."
        />
      ) : (
        <div className="space-y-3">
          {courses.map(({ course, enrollment, lessons }, index) => (
            <Card key={course.id} className="p-4" interactive onClick={() => navigate(`/curso/${course.id}`)}>
              <div className="flex items-start gap-3">
                <span className="shrink-0 grid place-items-center w-9 h-9 rounded-xl bg-navy text-linen-50 text-[13px] font-bold">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-[15.5px] leading-snug">{course.title}</h3>
                  <p className="text-[13px] text-ink-600 mt-0.5">{course.subtitle}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Chip tone="neutral">{lessons.length} aulas</Chip>
                    <Chip tone="sand">{course.hours}h</Chip>
                    <Chip tone="navy">{course.level}</Chip>
                  </div>
                  {enrollment && (
                    <div className="mt-3">
                      <ProgressBar value={enrollment.progressPct} showValue label={enrollment.status === "concluido" ? "Concluído" : "Seu progresso"} tone={enrollment.status === "concluido" ? "jade" : "navy"} />
                    </div>
                  )}
                </div>
                <Button size="sm" variant={enrollment ? "secondary" : "primary"} className="shrink-0 hidden sm:inline-flex">
                  {enrollment ? "Continuar" : "Começar"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {path.code === "NR1" && (
        <Card className="p-4 mt-5 border-copper/30 bg-copper/5">
          <BlockList
            blocks={[{
              kind: "callout",
              tone: "info",
              title: "Sobre o conteúdo de NR-1",
              text: "Conteúdo educativo. Consulte a legislação e os responsáveis técnicos da empresa para aplicação específica. A base normativa prioriza fontes oficiais do Ministério do Trabalho e Emprego.",
            }]}
          />
        </Card>
      )}
    </div>
  );
}
