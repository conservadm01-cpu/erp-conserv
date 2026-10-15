const tones = {
  green: "bg-green-100 text-green-800",
  red: "bg-red-100 text-red-800",
  amber: "bg-amber-100 text-amber-900",
  slate: "bg-slate-100 text-slate-700",
  blue: "bg-brand-100 text-brand-900",
};

export function Badge({ tone = "slate", children }: { tone?: keyof typeof tones; children: React.ReactNode }) {
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const tone = status === "ATIVA" || status === "ATIVO" || status === "SUCESSO" ? "green" : status === "BLOQUEADO" || status === "NEGADO" || status === "FALHA" ? "red" : "slate";
  const label: Record<string, string> = { ATIVA: "Ativa", INATIVA: "Inativa", ATIVO: "Ativo", INATIVO: "Inativo", BLOQUEADO: "Bloqueado", SUCESSO: "Sucesso", FALHA: "Falha", NEGADO: "Negado" };
  return <Badge tone={tone}>{label[status] ?? status}</Badge>;
}
