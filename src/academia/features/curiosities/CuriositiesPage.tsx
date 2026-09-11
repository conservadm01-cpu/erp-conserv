import { useState } from "react";
import { catalogRepo, competencyRepo, gamificationRepo } from "../../data/repositories";
import { useQuery } from "../../state/useCollection";
import { useAuth } from "../../auth/AuthContext";
import { useToast } from "../../state/ToastContext";
import { xpEngine } from "../../engines/gamification/XpEngine";
import { PageHeader } from "../../ui/layout/AppShell";
import { Card } from "../../ui/primitives/Card";
import { Chip } from "../../ui/primitives/Chip";
import { Icon } from "../../ui/primitives/Icon";
import { Tabs } from "../../ui/primitives/Tabs";
import { SourceBadge } from "../../ui/primitives/SourceBadge";
import { EmptyState } from "../../ui/primitives/Feedback";
import { cn } from "../../core/cn";

export function CuriositiesPage() {
  const { employee } = useAuth();
  const toast = useToast();
  const [category, setCategory] = useState("todas");
  const [read, setRead] = useState<string[]>([]);

  const data = useQuery(() => {
    const all = catalogRepo.publishedCuriosities();
    const categories = [...new Set(all.map((c) => c.category))].sort();
    const alreadyRead = employee
      ? new Set(gamificationRepo.xpOf(employee.id).filter((t) => t.refType === "curiosidade").map((t) => t.refId ?? ""))
      : new Set<string>();
    return { all, categories, alreadyRead };
  }, [employee?.id, read.length]);

  const list = category === "todas" ? data.all : data.all.filter((c) => c.category === category);

  const markRead = (id: string, xp: number, title: string) => {
    if (!employee || data.alreadyRead.has(id) || read.includes(id)) return;
    setRead([...read, id]);
    xpEngine.award(employee.id, xp, `Curiosidade lida: ${title}`, "curiosidade", id);
    toast.xp(xp, "Curiosidade lida");
  };

  return (
    <div>
      <PageHeader
        title="Curiosidades da fábrica"
        subtitle="Coisas pequenas que mudam o resultado. Cada uma vem de um material técnico da ConServ."
        icon="lightbulb"
      />

      <Tabs
        className="mb-4"
        active={category}
        onChange={setCategory}
        items={[
          { id: "todas", label: `Todas (${data.all.length})`, icon: "layers" },
          ...data.categories.map((c) => ({ id: c, label: c, badge: data.all.filter((x) => x.category === c).length })),
        ]}
      />

      {list.length === 0 ? (
        <EmptyState icon="lightbulb" title="Nenhuma curiosidade nesta categoria" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((curiosity) => {
            const isRead = data.alreadyRead.has(curiosity.id) || read.includes(curiosity.id);
            return (
              <Card
                key={curiosity.id}
                className={cn("p-4 flex flex-col", isRead ? "opacity-90" : "")}
                interactive
                onClick={() => markRead(curiosity.id, curiosity.xp, curiosity.title)}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 text-copper-600 text-[10.5px] font-bold uppercase tracking-wide">
                    <Icon name="lightbulb" size={13} />
                    Você sabia?
                  </div>
                  {isRead ? <Chip tone="jade" icon="check">lida</Chip> : <Chip tone="copper">+{curiosity.xp} XP</Chip>}
                </div>
                <h3 className="font-bold text-[15px] leading-snug">{curiosity.title}</h3>
                <p className="text-[14px] leading-relaxed mt-1.5 flex-1">{curiosity.text}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Chip tone="sand">{curiosity.category}</Chip>
                  <SourceBadge sourceRef={curiosity.sourceRef} />
                </div>
                {curiosity.competencies.length > 0 && (
                  <p className="text-[11px] text-ink-400 mt-2 truncate">
                    {curiosity.competencies.map((id) => competencyRepo.name(id)).join(" · ")}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
