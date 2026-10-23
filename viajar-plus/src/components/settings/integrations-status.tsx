"use client";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Loading, Notice } from "@/components/ui/states";
import { fmtDateTime } from "@/lib/format";
import type { IntegrationState, IntegrationStatus } from "@/lib/providers/registry";

const STATE: Record<IntegrationState, { label: string; tone: "green" | "amber" | "blue" | "neutral" | "red" }> = {
  configurada: { label: "Configurada", tone: "green" },
  pendente: { label: "Integração pendente", tone: "amber" },
  publica: { label: "Pública (sem chave)", tone: "blue" },
  indisponivel: { label: "Sem API — links externos", tone: "neutral" },
  ficticia: { label: "Fictícia (dev)", tone: "red" },
};

/** Lista o estado de cada integração lido do servidor (nunca mostra credenciais). */
export function IntegrationsStatus() {
  const [items, setItems] = useState<IntegrationStatus[] | null>(null);
  const [checked, setChecked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/status", { cache: "no-store" });
      const json = (await res.json()) as { integrations?: IntegrationStatus[]; checked_at?: string; error?: string };
      if (!res.ok || !json.integrations) throw new Error(json.error ?? "Não foi possível ler o status");
      setItems(json.integrations);
      setChecked(json.checked_at ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <CardHeader
        title="Integrações"
        subtitle="Credenciais ficam só no servidor (variáveis de ambiente). Sem credenciais, as buscas mostram “consulta real indisponível” e links externos — nunca resultados inventados."
        action={
          <Button size="sm" variant="outline" onClick={load} loading={loading}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Verificar
          </Button>
        }
      />
      <CardBody>
        {error && <Notice tone="error">{error}</Notice>}
        {!items && !error && <Loading rows={2} />}
        {items && (
          <ul className="divide-y divide-line">
            {items.map((i) => (
              <li key={i.key} className="flex flex-wrap items-start justify-between gap-2 py-3">
                <div className="min-w-0">
                  <div className="font-medium">{i.name}</div>
                  <div className="text-xs text-muted">
                    {i.area} · {i.detail}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={STATE[i.state].tone}>{STATE[i.state].label}</Badge>
                  <code className="text-[11px] text-muted" title="Documentação no repositório">
                    {i.docs}
                  </code>
                </div>
              </li>
            ))}
          </ul>
        )}
        {checked && <p className="mt-2 text-xs text-muted">Verificado em {fmtDateTime(checked)}. “Configurada” indica credenciais presentes, não que a API respondeu.</p>}
      </CardBody>
    </Card>
  );
}
