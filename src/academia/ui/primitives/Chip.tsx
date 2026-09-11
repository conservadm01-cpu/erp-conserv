import React from "react";
import { cn } from "../../core/cn";
import { Icon } from "./Icon";

type Tone = "navy" | "copper" | "jade" | "sand" | "alert" | "neutral";

const TONES: Record<Tone, string> = {
  navy: "bg-navy/10 text-navy-800 border-navy/20",
  copper: "bg-copper/10 text-copper-600 border-copper/25",
  jade: "bg-jade/10 text-jade-600 border-jade/25",
  sand: "bg-sand/25 text-ink-600 border-sand",
  alert: "bg-alert/10 text-alert border-alert/25",
  neutral: "bg-ink/5 text-ink-600 border-ink/10",
};

export function Chip({ children, tone = "neutral", icon, className, title }: {
  children: React.ReactNode;
  tone?: Tone;
  icon?: string;
  className?: string;
  title?: string;
}) {
  return (
    <span className={cn("chip", TONES[tone], className)} title={title}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; tone: Tone }> = {
    draft: { label: "Rascunho", tone: "neutral" },
    processing: { label: "Analisando", tone: "navy" },
    pending_review: { label: "Aguardando aprovação", tone: "copper" },
    approved: { label: "Aprovado", tone: "jade" },
    published: { label: "Publicado", tone: "jade" },
    archived: { label: "Arquivado", tone: "neutral" },
    rejected: { label: "Rejeitado", tone: "alert" },
    em_andamento: { label: "Em andamento", tone: "navy" },
    concluido: { label: "Concluído", tone: "jade" },
    nao_iniciado: { label: "Não iniciado", tone: "neutral" },
    reprovado: { label: "Não aprovado", tone: "alert" },
    valido: { label: "Válido", tone: "jade" },
    revogado: { label: "Revogado", tone: "alert" },
    expirado: { label: "Expirado", tone: "copper" },
    aberto: { label: "Aberto", tone: "alert" },
    em_analise: { label: "Em análise", tone: "copper" },
    acao_definida: { label: "Ação definida", tone: "navy" },
    resolvido: { label: "Resolvido", tone: "jade" },
    encerrado: { label: "Encerrado", tone: "neutral" },
  };
  const entry = map[status] ?? { label: status, tone: "neutral" as Tone };
  return <Chip tone={entry.tone}>{entry.label}</Chip>;
}
