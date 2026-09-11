import { catalogRepo, competencyRepo, peopleRepo } from "../../data/repositories";
import { useQuery } from "../../state/useCollection";
import { useAuth } from "../../auth/AuthContext";
import { useRouter } from "../../router/Router";
import { competencyEngine, LEVEL_NAMES } from "../../engines/competency/CompetencyEngine";
import { PageHeader } from "../../ui/layout/AppShell";
import { Card, SectionTitle } from "../../ui/primitives/Card";
import { Chip } from "../../ui/primitives/Chip";
import { Icon } from "../../ui/primitives/Icon";
import { LevelMeter } from "../../ui/primitives/Progress";
import { Button } from "../../ui/primitives/Button";
import { EmptyState } from "../../ui/primitives/Feedback";
import { CharacterSpeech } from "../../ui/characters/Character";
import { formatDate } from "../../core/dates";
import { cn } from "../../core/cn";

export function CompetenciesPage() {
  const { employee } = useAuth();
  const { navigate } = useRouter();

  const data = useQuery(() => {
    if (!employee) return null;
    const matrix = competencyEngine.matrixOf(employee.id);
    const gaps = competencyEngine.gaps(employee.id);
    const role = peopleRepo.jobRole(employee.jobRoleId);
    const recommendations = competencyEngine.recommendations(employee.id, 5);
    const entries = competencyRepo.ofEmployee(employee.id);
    return { matrix, gaps, role, recommendations, entries };
  }, [employee?.id]);

  if (!employee || !data) return null;
  const { matrix, gaps, role, recommendations, entries } = data;
  const areas = [...matrix.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div>
      <PageHeader
        title="Minhas competências"
        subtitle={`Matriz da função ${role?.name ?? employee.cargo}: onde você está e onde a função espera que você chegue.`}
        icon="target"
      />

      <Card className="p-4 mb-5">
        <div className="label">Como ler os níveis</div>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {(Object.keys(LEVEL_NAMES) as unknown as Array<keyof typeof LEVEL_NAMES>).map((key) => (
            <div key={key} className="flex items-center gap-2">
              <span className="grid place-items-center w-6 h-6 rounded-lg bg-navy text-linen-50 text-[11px] font-bold">{key}</span>
              <span className="text-[13px]">{LEVEL_NAMES[key]}</span>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-ink-400 mt-3">
          Contorno em cobre = nível esperado para a sua função. Os níveis crescem conforme você conclui aulas,
          quizzes, desafios, jogos e cursos — e podem ser confirmados numa avaliação do gestor.
        </p>
      </Card>

      {gaps.length > 0 && (
        <Card className="p-4 sm:p-5 mb-5 border-copper/30 bg-copper/5">
          <CharacterSpeech character="mestre" compact>
            {`Você domina ${entries.filter((e) => e.level >= 4).length} competência(s) em nível avançado ou acima. O caminho mais curto agora é reforçar ${gaps[0].competencyName.toLowerCase()}.`}
          </CharacterSpeech>
          <div className="mt-4 space-y-2">
            {gaps.slice(0, 4).map((gap) => (
              <div key={gap.competencyId} className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-linen-50 border border-sand/70">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[14px]">{gap.competencyName}</div>
                  <div className="text-[12.5px] text-ink-600">
                    Hoje: {competencyEngine.levelName(gap.current)} · Esperado: {competencyEngine.levelName(gap.target)}
                  </div>
                </div>
                <LevelMeter level={gap.current || 0} target={gap.target} />
                {gap.recommendedCourseIds[0] && (
                  <Button size="sm" variant="copper" icon="book-open" onClick={() => navigate(`/curso/${gap.recommendedCourseIds[0]}`)}>
                    {catalogRepo.course(gap.recommendedCourseIds[0])?.title.slice(0, 26) ?? "Curso"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {areas.length === 0 ? (
        <EmptyState
          icon="target"
          title="Sua matriz está começando"
          description="Conclua a primeira aula para a matriz de competências começar a ser preenchida."
          action={<Button icon="compass" onClick={() => navigate("/trilhas")}>Ver trilhas</Button>}
        />
      ) : (
        <div className="space-y-5">
          {areas.map(([area, items]) => (
            <div key={area}>
              <SectionTitle>{area}</SectionTitle>
              <Card>
                <ul>
                  {items.sort((a, b) => b.level - a.level).map((item) => {
                    const entry = competencyRepo.entry(employee.id, item.competencyId);
                    const reached = item.target ? item.level >= item.target : true;
                    return (
                      <li key={item.competencyId} className="px-4 py-3 border-b border-sand/40 last:border-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-[14.5px] flex items-center gap-2">
                              {item.name}
                              {item.target && (
                                <Chip tone={reached ? "jade" : "copper"}>
                                  {reached ? "no alvo" : `alvo ${item.target}`}
                                </Chip>
                              )}
                            </div>
                            <div className="text-[12.5px] text-ink-600">
                              {item.level > 0 ? competencyEngine.levelName(item.level) : "Ainda não avaliado"}
                              {entry?.assessedAt && ` · atualizado em ${formatDate(entry.assessedAt)}`}
                            </div>
                          </div>
                          <LevelMeter level={item.level} target={item.target} />
                        </div>
                        {entry && entry.evidence.length > 0 && (
                          <details className="mt-2">
                            <summary className="text-[12px] font-semibold text-navy cursor-pointer">
                              Ver evidências ({entry.evidence.length})
                            </summary>
                            <ul className="mt-1.5 space-y-1">
                              {entry.evidence.slice(-6).reverse().map((evidence, i) => (
                                <li key={i} className="text-[12.5px] text-ink-600 flex items-center gap-2">
                                  <Icon name={evidence.kind === "quiz" ? "clipboard" : evidence.kind === "jogo" ? "gamepad-2" : evidence.kind === "curso" ? "book-open" : "check"} size={13} />
                                  {evidence.label} · {formatDate(evidence.at)}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </div>
          ))}
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="mt-6">
          <SectionTitle hint="Cursos que desenvolvem o que falta na sua função.">Plano de desenvolvimento</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {recommendations.map((rec) => (
              <Card key={rec.id} className={cn("p-4")} interactive onClick={() => navigate(rec.link)}>
                <h3 className="font-bold text-[14.5px]">{rec.title}</h3>
                <p className="text-[13px] text-ink-600 mt-1">{rec.reason}</p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
