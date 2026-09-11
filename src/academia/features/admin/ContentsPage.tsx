import { useState } from "react";
import { catalogRepo } from "../../data/repositories";
import { useQuery } from "../../state/useCollection";
import { useRouter } from "../../router/Router";
import { PageHeader } from "../../ui/layout/AppShell";
import { Card } from "../../ui/primitives/Card";
import { Button } from "../../ui/primitives/Button";
import { Chip, StatusChip } from "../../ui/primitives/Chip";
import { Icon } from "../../ui/primitives/Icon";
import { Tabs } from "../../ui/primitives/Tabs";
import { TextInput } from "../../ui/primitives/Field";
import { EmptyState } from "../../ui/primitives/Feedback";
import { relativeFrom } from "../../core/dates";

export function ContentsPage() {
  const { navigate } = useRouter();
  const [filter, setFilter] = useState("todos");
  const [term, setTerm] = useState("");

  const data = useQuery(() => {
    const all = catalogRepo.searchContents(term);
    return {
      all,
      pending: all.filter((c) => c.status === "pending_review" || c.status === "processing"),
      published: all.filter((c) => c.status === "published"),
      drafts: all.filter((c) => c.status === "draft"),
      archived: all.filter((c) => c.status === "archived" || c.status === "rejected"),
    };
  }, [term]);

  const list = filter === "pendentes" ? data.pending
    : filter === "publicados" ? data.published
    : filter === "rascunhos" ? data.drafts
    : filter === "arquivados" ? data.archived
    : data.all;

  return (
    <div>
      <PageHeader
        title="Banco de Conhecimento ConServ"
        subtitle="Todo material da empresa em um lugar. É daqui que nascem cursos, quizzes, jogos e apostilas."
        icon="file"
        action={<Button icon="plus" onClick={() => navigate("/admin/conteudos/novo")}>Novo conteúdo</Button>}
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <TextInput
          value={term}
          aria-label="Buscar conteúdo no Banco de Conhecimento"
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar por título, descrição, palavra-chave ou categoria…"
          className="sm:max-w-md"
        />
      </div>

      <Tabs
        className="mb-4"
        active={filter}
        onChange={setFilter}
        items={[
          { id: "todos", label: "Todos", badge: data.all.length },
          { id: "pendentes", label: "Aguardando aprovação", icon: "alert", badge: data.pending.length },
          { id: "publicados", label: "Publicados", icon: "check-circle", badge: data.published.length },
          { id: "rascunhos", label: "Rascunhos", badge: data.drafts.length },
          { id: "arquivados", label: "Arquivados", badge: data.archived.length },
        ]}
      />

      {list.length === 0 ? (
        <EmptyState
          icon="upload"
          title="Nenhum conteúdo aqui"
          description="Envie um PDF, DOCX, PPTX, imagem, vídeo, URL ou texto. A plataforma extrai, analisa e sugere o material educacional."
          action={<Button icon="plus" onClick={() => navigate("/admin/conteudos/novo")}>Novo conteúdo</Button>}
        />
      ) : (
        <div className="space-y-2.5">
          {list.map((content) => {
            const counts = content.generated;
            return (
              <Card key={content.id} className="p-4" interactive onClick={() => navigate(`/admin/conteudos/${content.id}`)}>
                <div className="flex flex-wrap items-start gap-3">
                  <span className="shrink-0 grid place-items-center w-10 h-10 rounded-xl bg-navy/10 text-navy border border-navy/20">
                    <Icon name={content.source.type === "pdf" ? "file" : content.source.type === "url" ? "compass" : content.source.type === "imagem" ? "image" : "file"} size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-[15px] leading-snug">{content.title}</h3>
                      <StatusChip status={content.status} />
                    </div>
                    <p className="text-[13px] text-ink-600 mt-0.5 line-clamp-2">{content.description || "Sem descrição."}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Chip tone="neutral">{content.id}</Chip>
                      <Chip tone="sand">v{content.version}</Chip>
                      <Chip tone="navy">{content.category}</Chip>
                      <Chip tone="neutral">{content.contentType}</Chip>
                      <Chip tone="neutral">{content.chunks.length} trechos</Chip>
                      {content.analysis && <Chip tone="jade" icon="sparkles">analisado</Chip>}
                    </div>
                    <p className="text-[11.5px] text-ink-400 mt-1.5">
                      Atualizado {relativeFrom(content.updatedAt)}
                      {" · gerou "}
                      {counts.lessonIds.length} aula(s), {counts.questionIds.length} questão(ões), {counts.gameIds.length} jogo(s),
                      {" "}{counts.curiosityIds.length} curiosidade(s), {counts.courseIds.length} curso(s)
                    </p>
                  </div>
                  <Icon name="chevron-right" size={18} className="text-ink-400 shrink-0 mt-2" />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
