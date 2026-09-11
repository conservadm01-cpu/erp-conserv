import { catalogRepo, certificateRepo, competencyRepo, gamificationRepo, learningRepo, peopleRepo, settingsRepo } from "../../data/repositories";
import { useQuery } from "../../state/useCollection";
import { useAuth } from "../../auth/AuthContext";
import { xpEngine } from "../../engines/gamification/XpEngine";
import { adaptiveEngine } from "../../engines/learning/AdaptiveEngine";
import { competencyEngine } from "../../engines/competency/CompetencyEngine";
import { progressEngine } from "../../engines/learning/ProgressEngine";
import { firstName } from "../../core/cn";
import { formatDate, relativeFrom } from "../../core/dates";
import { Card, CardHeader, SectionTitle, accentClasses } from "../../ui/primitives/Card";
import { Button } from "../../ui/primitives/Button";
import { Chip } from "../../ui/primitives/Chip";
import { Icon } from "../../ui/primitives/Icon";
import { ProgressBar, LevelMeter } from "../../ui/primitives/Progress";
import { StatTile, EmptyState } from "../../ui/primitives/Feedback";
import { Link, useRouter } from "../../router/Router";
import { DailyChallengeCard } from "../challenges/DailyChallenge";
import { cn } from "../../core/cn";

export function DashboardPage() {
  const { employee } = useAuth();
  const { navigate } = useRouter();
  const settings = useQuery(() => settingsRepo.get());

  const data = useQuery(() => {
    if (!employee) return null;
    const level = xpEngine.level(employee.id);
    const inProgress = learningRepo.inProgress(employee.id).map((enrollment) => ({
      enrollment,
      course: catalogRepo.course(enrollment.courseId),
      nextLesson: progressEngine.nextLesson(employee.id, enrollment.courseId),
    })).filter((item) => item.course);
    const completed = learningRepo.completed(employee.id);
    const certificates = certificateRepo.ofEmployee(employee.id);
    const badges = gamificationRepo.badgesOf(employee.id);
    const lastBadge = badges[0];
    const recommendations = adaptiveEngine.recommendations(employee.id, 4);
    const gaps = competencyEngine.gaps(employee.id).slice(0, 3);
    const strengths = competencyRepo.ofEmployee(employee.id)
      .filter((c) => c.level >= 4)
      .sort((a, b) => b.level - a.level)
      .slice(0, 3);
    const curiosity = catalogRepo.publishedCuriosities()[Math.floor(Date.now() / 86400000) % Math.max(1, catalogRepo.publishedCuriosities().length)];
    const weak = adaptiveEngine.weakPoints(employee.id, 1)[0];
    const supervisor = employee.supervisorId ? peopleRepo.employee(employee.supervisorId) : undefined;
    return { level, inProgress, completed, certificates, badges, lastBadge, recommendations, gaps, strengths, curiosity, weak, supervisor };
  }, [employee?.id]);

  if (!employee || !data) return null;
  const { level, inProgress, completed, certificates, lastBadge, recommendations, gaps, strengths, curiosity, weak } = data;
  const keepLearning = inProgress[0];

  return (
    <div className="space-y-7">
      {/* Saudação + nível */}
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5 sm:p-6 bg-gradient-to-br from-navy-900 to-navy text-linen-50 border-navy-800">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[13px] text-sand-300 font-semibold">
                {new Date().getHours() < 12 ? "Bom dia" : new Date().getHours() < 18 ? "Boa tarde" : "Boa noite"}
              </p>
              <h1 className="text-[26px] sm:text-[32px] font-bold leading-tight text-linen-50">Olá, {firstName(employee.name)}!</h1>
              <p className="text-[14px] text-linen-200/85 mt-1.5">
                {keepLearning?.course
                  ? `Você está em ${keepLearning.course.title} — ${keepLearning.enrollment.progressPct}% concluído.`
                  : "Escolha uma trilha e comece sua jornada hoje."}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[11px] uppercase tracking-wide text-sand-300">Nível {level.level}</div>
              <div className="text-[17px] font-bold">{level.name}</div>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex justify-between text-[12px] text-linen-200/80 mb-1.5">
              <span className="font-semibold tabular-nums">{level.xp} XP</span>
              <span>{level.xpToNext !== null ? `faltam ${level.xpToNext} XP para o nível ${level.level + 1}` : "nível máximo"}</span>
            </div>
            <div className="h-2.5 rounded-full bg-linen-50/15 overflow-hidden">
              <div className="h-full bg-copper-300 rounded-full transition-[width] duration-700" style={{ width: `${level.progressPct}%` }} />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              size="lg"
              variant="copper"
              icon="play"
              onClick={() => {
                if (keepLearning?.nextLesson) navigate(`/curso/${keepLearning.course!.id}/aula/${keepLearning.nextLesson.id}`);
                else if (keepLearning?.course) navigate(`/curso/${keepLearning.course.id}`);
                else navigate("/trilhas");
              }}
            >
              Continuar aprendizado
            </Button>
            <Button size="lg" variant="secondary" icon="compass" onClick={() => navigate("/trilhas")}>Ver trilhas</Button>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3 content-start">
          <StatTile label="Cursos em andamento" value={inProgress.length} icon="book-open" />
          <StatTile label="Cursos concluídos" value={completed.length} icon="check-circle" accent="jade" />
          <StatTile label="Certificados" value={certificates.length} icon="award" accent="copper" onClick={() => navigate("/certificados")} />
          <StatTile
            label="Última conquista"
            value={lastBadge ? <span className="text-[15px]">{gamificationRepo.badge(lastBadge.badgeId)?.name}</span> : "—"}
            hint={lastBadge ? relativeFrom(lastBadge.earnedAt) : "Conquiste seu primeiro badge"}
            icon="trophy"
            accent="sand"
            onClick={() => navigate("/perfil")}
          />
        </div>
      </section>

      {/* Desafio do dia */}
      <section>
        <SectionTitle hint="Uma situação real da fábrica por dia. Responda e veja a explicação.">Desafio do dia</SectionTitle>
        <DailyChallengeCard />
      </section>

      {/* Continuar + recomendações */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div>
          <SectionTitle hint="Retome de onde parou.">Meus cursos</SectionTitle>
          {inProgress.length === 0 ? (
            <EmptyState
              icon="book-open"
              title="Nenhum curso em andamento"
              description="As trilhas da ConServ estão prontas para você começar."
              action={<Button icon="compass" onClick={() => navigate("/trilhas")}>Escolher trilha</Button>}
            />
          ) : (
            <div className="space-y-3">
              {inProgress.map(({ enrollment, course, nextLesson }) => (
                <Card key={enrollment.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <span className={cn("shrink-0 grid place-items-center w-11 h-11 rounded-xl border", accentClasses(course!.accent))}>
                      <Icon name={course!.icon} size={21} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-[15px] leading-snug">{course!.title}</h3>
                      <p className="text-[12.5px] text-ink-600 mt-0.5">
                        {enrollment.lessonsDone} de {enrollment.lessonsTotal} aulas · {course!.hours}h
                      </p>
                      <div className="mt-2.5">
                        <ProgressBar value={enrollment.progressPct} showValue />
                      </div>
                      {nextLesson && (
                        <p className="text-[12.5px] text-ink-600 mt-2">
                          <span className="font-semibold text-navy-900">Próxima aula:</span> {nextLesson.title}
                        </p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          icon="play"
                          onClick={() => navigate(nextLesson ? `/curso/${course!.id}/aula/${nextLesson.id}` : `/curso/${course!.id}`)}
                        >
                          {nextLesson ? "Continuar" : "Ir para avaliação"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/curso/${course!.id}`)}>Ver curso</Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionTitle hint="Com base no seu desempenho e na sua função.">Recomendado para você</SectionTitle>
          <div className="space-y-3">
            {weak && (
              <Card className="p-4 border-copper/30 bg-copper/5">
                <div className="flex items-start gap-3">
                  <span className="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-copper/15 text-copper-600 border border-copper/25">
                    <Icon name="target" size={19} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold uppercase tracking-wide text-copper-600">Você precisa reforçar</div>
                    <h3 className="font-bold text-[15px]">{weak.subject}</h3>
                    <p className="text-[13px] text-ink-600 mt-0.5">
                      {Math.round(weak.accuracy * 100)}% de acerto nesse assunto nas últimas questões.
                    </p>
                    <Button size="sm" variant="copper" className="mt-2.5" icon="rotate" onClick={() => navigate(`/reforco/${encodeURIComponent(weak.subject)}`)}>
                      Aprender novamente
                    </Button>
                  </div>
                </div>
              </Card>
            )}
            {recommendations.map((rec) => (
              <Card key={rec.id} className="p-4" interactive onClick={() => navigate(rec.link)}>
                <div className="flex items-start gap-3">
                  <span className="shrink-0 grid place-items-center w-9 h-9 rounded-xl bg-navy/10 text-navy border border-navy/20">
                    <Icon name={rec.kind === "jogo" ? "gamepad-2" : rec.kind === "curso" ? "book-open" : rec.kind === "reforco" ? "rotate" : "play"} size={17} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-bold text-[14.5px] leading-snug">{rec.title}</h3>
                    <p className="text-[12.5px] text-ink-600 mt-0.5">{rec.reason}</p>
                  </div>
                  <Icon name="chevron-right" size={18} className="ml-auto shrink-0 text-ink-400" />
                </div>
              </Card>
            ))}
            {recommendations.length === 0 && !weak && (
              <EmptyState icon="sparkles" title="Tudo em dia!" description="Sem pendências no seu plano. Explore as trilhas livres quando quiser." />
            )}
          </div>
        </div>
      </section>

      {/* Competências + curiosidade */}
      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Minhas competências"
            subtitle="Onde você está forte e onde vale desenvolver"
            icon="target"
            right={<Link to="/competencias" className="text-[12.5px] font-semibold text-navy underline">ver tudo</Link>}
          />
          <div className="px-4 sm:px-5 pb-5 space-y-3">
            {strengths.length > 0 && (
              <div>
                <div className="label">Seus pontos fortes</div>
                {strengths.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="text-[14px] truncate">{competencyRepo.name(entry.competencyId)}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11.5px] text-ink-600">{competencyEngine.levelName(entry.level)}</span>
                      <LevelMeter level={entry.level} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {gaps.length > 0 && (
              <div>
                <div className="label mt-2">Para desenvolver</div>
                {gaps.map((gap) => (
                  <div key={gap.competencyId} className="flex items-center justify-between gap-3 py-1.5">
                    <span className="text-[14px] truncate">{gap.competencyName}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11.5px] text-copper-600 font-semibold">
                        {competencyEngine.levelName(gap.current)} → {competencyEngine.levelName(gap.target)}
                      </span>
                      <LevelMeter level={gap.current || 0} target={gap.target} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {strengths.length === 0 && gaps.length === 0 && (
              <p className="text-[13.5px] text-ink-600">
                Sua matriz de competências começa a ser preenchida conforme você faz aulas, quizzes, desafios e jogos.
              </p>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          {curiosity && (
            <Card className="p-5 bg-copper/5 border-copper/25">
              <div className="flex items-center gap-2 text-copper-600 text-[11px] font-bold uppercase tracking-wide mb-1.5">
                <Icon name="lightbulb" size={15} />
                Curiosidade do dia
              </div>
              <h3 className="font-bold text-[15.5px]">{curiosity.title}</h3>
              <p className="text-[14.5px] leading-relaxed mt-1.5">{curiosity.text}</p>
              <Link to="/curiosidades" className="inline-block mt-3 text-[12.5px] font-semibold text-navy underline">
                Ver mais curiosidades
              </Link>
            </Card>
          )}
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="siren" size={18} className="text-alert" />
              <h3 className="font-bold text-[15px]">Viu algo que pode machucar alguém?</h3>
            </div>
            <p className="text-[13.5px] text-ink-600 leading-relaxed">
              Registre em 30 segundos. Pode ser anônimo. Quase acidente também conta — é a informação mais barata que existe em segurança.
            </p>
            <Button variant="danger" size="sm" icon="siren" className="mt-3" onClick={() => navigate("/risco")}>
              Eu vi um risco
            </Button>
          </Card>
          {certificates[0] && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-1.5">
                <Icon name="award" size={18} className="text-copper" />
                <h3 className="font-bold text-[15px]">Seu último certificado</h3>
              </div>
              <p className="text-[14px]">{certificates[0].title}</p>
              <p className="text-[12.5px] text-ink-600 mt-0.5">
                {formatDate(certificates[0].issuedAt)} · {certificates[0].hours}h · código {certificates[0].code}
              </p>
              <Chip tone="jade" className="mt-2">{certificates[0].classification}</Chip>
              <div className="mt-3">
                <Button size="sm" variant="secondary" icon="award" onClick={() => navigate(`/certificado/${certificates[0].code}`)}>
                  Ver certificado
                </Button>
              </div>
            </Card>
          )}
        </div>
      </section>

      <p className="text-[11.5px] text-ink-400 text-center">{settings.legalDisclaimer}</p>
    </div>
  );
}
