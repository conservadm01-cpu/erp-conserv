import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { catalogRepo, peopleRepo } from "../../data/repositories";
import { useQuery } from "../../state/useCollection";
import { useRouter } from "../../router/Router";
import { firstName } from "../../core/cn";
import { CharacterAvatar, CharacterSpeech } from "../../ui/characters/Character";
import { Button } from "../../ui/primitives/Button";
import { Card } from "../../ui/primitives/Card";
import { Icon } from "../../ui/primitives/Icon";
import { Chip } from "../../ui/primitives/Chip";
import { progressEngine } from "../../engines/learning/ProgressEngine";
import { xpEngine } from "../../engines/gamification/XpEngine";
import { useToast } from "../../state/ToastContext";
import { cn } from "../../core/cn";

/**
 * PRIMEIRA EXPERIÊNCIA (seção 42)
 * Boas-vindas do Mestre ConServ → começar a jornada → escolher o
 * primeiro desafio. Nada de formulário longo na entrada.
 */
export function OnboardingPage() {
  const { employee, completeOnboarding } = useAuth();
  const { navigate } = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);

  const options = useQuery(() => {
    if (!employee) return [];
    const roleName = peopleRepo.jobRoleName(employee.jobRoleId);
    const sector = peopleRepo.departmentName(employee.departmentId);
    const paths = catalogRepo.publishedPaths();
    const recommended = paths.filter((p) => p.courseIds.length > 0 && (p.recommendedFor.includes(roleName) || p.recommendedFor.includes("Todos")));
    const mine = recommended.filter((p) => p.recommendedFor.includes(roleName));
    const ordered = [...mine, ...recommended.filter((p) => !mine.includes(p))];
    return ordered.slice(0, 3).map((path) => {
      const course = catalogRepo.course(path.courseIds[0]);
      return { path, course, sector };
    }).filter((o) => o.course);
  }, [employee?.id]);

  if (!employee) return null;

  const start = (courseId: string) => {
    progressEngine.enroll(employee.id, courseId, "autoinscricao");
    const award = xpEngine.award(employee.id, 30, "Primeira jornada iniciada", "onboarding", courseId);
    toast.xp(30, "Bem-vindo à Academia!");
    if (award.newBadges.length > 0) toast.badges(award.newBadges);
    completeOnboarding();
    const next = progressEngine.nextLesson(employee.id, courseId);
    navigate(next ? `/curso/${courseId}/aula/${next.id}` : `/curso/${courseId}`);
  };

  return (
    <div className="min-h-[100dvh] bg-navy-900 text-linen-50 flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl">
        {step === 0 && (
          <div className="animate-fade-up text-center">
            <div className="flex justify-center mb-5">
              <CharacterAvatar character="mestre" size={104} />
            </div>
            <h1 className="text-[26px] sm:text-[34px] font-bold text-linen-50 leading-tight">
              Bem-vindo à Academia ConServ, {firstName(employee.name)}.
            </h1>
            <div className="mt-6 space-y-3 text-[16px] sm:text-[17px] leading-relaxed text-linen-200/90 max-w-xl mx-auto">
              <p>Você não está aqui apenas para aprender a operar uma máquina.</p>
              <p>
                Está aqui para se tornar um profissional que entende <strong className="text-linen-50">o que faz</strong>,
                {" "}<strong className="text-linen-50">por que faz</strong> e <strong className="text-linen-50">como fazer melhor</strong>.
              </p>
            </div>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" variant="copper" icon="arrow-right" onClick={() => setStep(1)}>
                Começar minha jornada
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="text-linen-200/80"
                onClick={() => {
                  completeOnboarding();
                  navigate("/");
                }}
              >
                Ver meu painel primeiro
              </Button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="animate-fade-up">
            <div className="mb-6">
              <CharacterSpeech character="mestre" size={56} className="text-linen-50">
                <span className="text-linen-50">
                  Escolha seu primeiro desafio. Pode mudar depois — aqui ninguém fica preso a um caminho só.
                </span>
              </CharacterSpeech>
            </div>

            <div className="space-y-3">
              {options.map(({ path, course }) => (
                <Card key={path.id} className="p-4 sm:p-5 text-ink" interactive onClick={() => start(course!.id)}>
                  <div className="flex items-start gap-4">
                    <span className="shrink-0 grid place-items-center w-12 h-12 rounded-xl bg-navy text-linen-50">
                      <Icon name={path.icon} size={24} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="font-bold text-[16px]">{path.title}</h3>
                        {path.mandatory && <Chip tone="copper">Obrigatória</Chip>}
                      </div>
                      <p className="text-[13.5px] text-ink-600 leading-snug">{path.description}</p>
                      <p className="text-[13px] mt-2">
                        <span className="font-semibold text-navy-900">Começa com:</span> {course!.title} · {course!.hours}h
                      </p>
                    </div>
                    <Icon name="chevron-right" size={20} className="shrink-0 text-ink-400 mt-3" />
                  </div>
                </Card>
              ))}
            </div>

            <div className={cn("mt-5 flex justify-between items-center")}>
              <Button variant="ghost" className="text-linen-200/80" icon="arrow-left" onClick={() => setStep(0)}>Voltar</Button>
              <Button
                variant="secondary"
                onClick={() => {
                  completeOnboarding();
                  navigate("/trilhas");
                }}
              >
                Ver todas as 17 trilhas
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
