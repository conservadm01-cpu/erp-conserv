import { catalogRepo } from "../../data/repositories";
import { useQuery } from "../../state/useCollection";
import { useRouter } from "../../router/Router";
import { PageHeader } from "../../ui/layout/AppShell";
import { Card } from "../../ui/primitives/Card";
import { Button } from "../../ui/primitives/Button";
import { Chip, StatusChip } from "../../ui/primitives/Chip";
import { Icon } from "../../ui/primitives/Icon";
import { EmptyState } from "../../ui/primitives/Feedback";
import { BlockList } from "../../ui/content/BlockRenderer";
import { formatDate } from "../../core/dates";

export function HandbooksPage() {
  const { navigate } = useRouter();
  const handbooks = useQuery(() => catalogRepo.handbooks().filter((h) => h.status === "published"));

  return (
    <div>
      <PageHeader
        title="Apostilas"
        subtitle="Material completo para estudar, imprimir ou levar para o posto."
        icon="book-open"
      />
      {handbooks.length === 0 ? (
        <EmptyState icon="book-open" title="Nenhuma apostila publicada" description="A coordenação pode gerar apostilas a partir de qualquer curso ou material do Banco de Conhecimento." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {handbooks.map((handbook) => (
            <Card key={handbook.id} className="p-4" interactive onClick={() => navigate(`/apostila/${handbook.id}`)}>
              <div className="flex items-start gap-3">
                <span className="shrink-0 grid place-items-center w-11 h-11 rounded-xl bg-navy text-linen-50">
                  <Icon name="book-open" size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-[15px] leading-snug">{handbook.title}</h3>
                  <p className="text-[12.5px] text-ink-600 mt-0.5">
                    v{handbook.version} · {handbook.hours}h · {handbook.sections.length} seções
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Chip tone="neutral">{handbook.code}</Chip>
                    <Chip tone="sand">{formatDate(handbook.date)}</Chip>
                  </div>
                </div>
                <Icon name="chevron-right" size={18} className="text-ink-400 shrink-0" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export function HandbookViewPage({ handbookId }: { handbookId: string }) {
  const { navigate } = useRouter();
  const handbook = useQuery(() => catalogRepo.handbook(handbookId), [handbookId]);

  if (!handbook) return <EmptyState icon="book-open" title="Apostila não encontrada" />;

  const cover = handbook.sections.find((s) => s.kind === "capa");
  const rest = handbook.sections.filter((s) => s.kind !== "capa");

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-wrap gap-2 mb-4 no-print">
        <Button variant="secondary" icon="arrow-left" onClick={() => navigate("/apostilas")}>Apostilas</Button>
        <Button icon="printer" onClick={() => window.print()}>Imprimir / salvar PDF</Button>
        {handbook.courseId && (
          <Button variant="secondary" icon="book-open" onClick={() => navigate(`/curso/${handbook.courseId}`)}>Ver o curso</Button>
        )}
        <StatusChip status={handbook.status} />
      </div>

      <article className="print-area card p-5 sm:p-8 space-y-8">
        {/* Capa */}
        <header className="print-page">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-ink-600">ConServ Confecções · Academia ConServ</div>
          <h1 className="text-[28px] sm:text-[36px] font-bold leading-tight mt-2">{handbook.title}</h1>
          {handbook.subtitle && <p className="text-[15px] text-ink-600 mt-1.5">{handbook.subtitle}</p>}
          <div className="mt-5">{cover && <BlockList blocks={cover.blocks.filter((b) => b.kind !== "heading")} />}</div>
        </header>

        {/* Seções */}
        {rest.map((section) => (
          <section key={section.id} className="print-avoid-break">
            <h2 className="text-[20px] font-bold border-b border-sand pb-1.5 mb-3">{section.title}</h2>
            <BlockList blocks={section.blocks} />
          </section>
        ))}

        <footer className="border-t border-sand pt-4 text-[11.5px] text-ink-600 leading-relaxed">
          <p>
            <strong>{handbook.title}</strong> · versão {handbook.version} · {handbook.hours}h · {handbook.author} ·
            {" "}{formatDate(handbook.date)} · código {handbook.code}
          </p>
          <p className="mt-1">
            Material de treinamento interno da ConServ Confecções. Conteúdo educativo: consulte a legislação e os
            responsáveis técnicos da empresa para aplicação específica.
          </p>
        </footer>
      </article>
    </div>
  );
}
