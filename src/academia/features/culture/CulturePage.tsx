import { catalogRepo } from "../../data/repositories";
import { useQuery } from "../../state/useCollection";
import { useRouter } from "../../router/Router";
import { PageHeader } from "../../ui/layout/AppShell";
import { Card, SectionTitle } from "../../ui/primitives/Card";
import { Chip } from "../../ui/primitives/Chip";
import { Icon } from "../../ui/primitives/Icon";
import { Button } from "../../ui/primitives/Button";
import { SourceBadge } from "../../ui/primitives/SourceBadge";
import { CharacterSpeech } from "../../ui/characters/Character";
import { cn } from "../../core/cn";

const JOURNEY = [
  { label: "Tecido", icon: "scroll", note: "Largura conferida, malha relaxada, lote identificado." },
  { label: "Corte", icon: "scissors", note: "Enfesto sem tensão e sentido do fio respeitado." },
  { label: "Preparação", icon: "layers", note: "Partes separadas, mesmo lote, pacote completo." },
  { label: "Silk", icon: "palette", note: "Posição medida, pressão certa, cura registrada." },
  { label: "Costura", icon: "git-merge", note: "Agulha certa, regulagem testada, primeira peça conferida." },
  { label: "Revisão", icon: "eye", note: "Olho de quem vai comprar, não de quem quer terminar." },
  { label: "Embalagem", icon: "package", note: "Dobra no padrão, contagem certa, lote identificado." },
  { label: "Cliente", icon: "smile", note: "A peça que alguém vai vestir num dia importante." },
];

const VALUES = [
  { title: "Respeito", text: "Pelo colega e pelo trabalho dele. Ninguém termina um pedido sozinho.", icon: "users" },
  { title: "Responsabilidade", text: "Pelo que sai da sua mão. O que passa do seu posto leva seu nome.", icon: "check-circle" },
  { title: "Qualidade", text: "Fazer certo na primeira vez é mais rápido que refazer.", icon: "star" },
  { title: "Cuidado com máquina e material", text: "É o patrimônio que garante o emprego de todos.", icon: "wrench" },
  { title: "Limpeza e organização", text: "Parte do ofício, não tarefa extra.", icon: "sparkles" },
  { title: "Pontualidade", text: "A linha depende de todos estarem no posto.", icon: "clock" },
  { title: "Comunicação", text: "Problema falado custa menos que problema escondido.", icon: "info" },
  { title: "Orgulho profissional", text: "Entregar a peça do jeito que você gostaria de receber.", icon: "heart" },
];

export function CulturePage() {
  const { navigate } = useRouter();
  const story = useQuery(() => catalogRepo.content("CNT-000010"));

  return (
    <div>
      <PageHeader
        title="Cultura ConServ"
        subtitle="O que a gente valoriza e por que cada etapa importa."
        icon="heart"
      />

      <div className="mb-6">
        <CharacterSpeech character="mestre">
          Toda peça que sai daqui passou pela mão de muita gente. Nenhuma etapa aparece sozinha na camiseta — o que
          aparece é o conjunto.
        </CharacterSpeech>
      </div>

      {/* Jornada da peça */}
      <section className="mb-8">
        <SectionTitle hint="A camiseta que saiu da ConServ: onde cada decisão entra.">A jornada da peça</SectionTitle>
        <Card className="p-4 sm:p-5">
          <ol className="space-y-0">
            {JOURNEY.map((step, i) => (
              <li key={step.label} className="flex gap-3.5">
                <div className="flex flex-col items-center">
                  <span className={cn(
                    "grid place-items-center w-10 h-10 rounded-xl border shrink-0",
                    i === JOURNEY.length - 1 ? "bg-copper text-linen-50 border-copper" : "bg-navy text-linen-50 border-navy-800",
                  )}>
                    <Icon name={step.icon} size={19} />
                  </span>
                  {i < JOURNEY.length - 1 && <span className="w-0.5 flex-1 bg-sand my-1 min-h-[18px]" />}
                </div>
                <div className="pb-5 min-w-0">
                  <div className="font-bold text-[15px]">{step.label}</div>
                  <p className="text-[13.5px] text-ink-600 leading-snug mt-0.5">{step.note}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      {/* História completa (conteúdo do banco) */}
      {story && (
        <section className="mb-8">
          <SectionTitle hint={`${story.id} · v${story.version} — material de cultura da ConServ`}>
            A camiseta que saiu da ConServ
          </SectionTitle>
          <Card className="p-4 sm:p-6">
            <div className="space-y-4">
              {story.chunks.map((chunk) => (
                <div key={chunk.index}>
                  <p className="text-[15.5px] leading-[1.72]">{chunk.text}</p>
                  <SourceBadge sourceId={chunk.sourceId} className="mt-1" />
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      {/* Valores */}
      <section className="mb-8">
        <SectionTitle>Nossos valores no dia a dia</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {VALUES.map((value) => (
            <Card key={value.title} className="p-4">
              <span className="grid place-items-center w-9 h-9 rounded-xl bg-copper/10 text-copper-600 border border-copper/25 mb-2">
                <Icon name={value.icon} size={18} />
              </span>
              <h3 className="font-bold text-[14.5px]">{value.title}</h3>
              <p className="text-[13px] text-ink-600 mt-1 leading-snug">{value.text}</p>
            </Card>
          ))}
        </div>
      </section>

      <Card className="p-5 bg-navy-900 text-linen-50 border-navy-800">
        <h3 className="font-bold text-[17px] text-linen-50">Quer começar pela cultura?</h3>
        <p className="text-[14px] text-linen-200/85 mt-1">
          A trilha Cultura ConServ reúne histórias, valores e situações reais da fábrica.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          <Button variant="copper" icon="compass" onClick={() => navigate("/trilha/PTH-01")}>Trilha Cultura ConServ</Button>
          <Button variant="secondary" icon="gamepad-2" onClick={() => navigate("/jogos/GAM-000002")}>Jogar “Monte a Camiseta”</Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Chip tone="sand">orgulho</Chip>
          <Chip tone="sand">respeito</Chip>
          <Chip tone="sand">qualidade</Chip>
          <Chip tone="sand">equipe</Chip>
        </div>
      </Card>
    </div>
  );
}
