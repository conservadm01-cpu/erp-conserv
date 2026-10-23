import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/states";
import { fmtDateTime } from "@/lib/format";
import type { ExternalLink as Link } from "@/lib/providers/links";
import type { SearchApiResponse } from "@/lib/providers/search-response";

export function ExternalLinks({ links, title = "Pesquisar nos sites dos fornecedores" }: { links: Link[]; title?: string }) {
  if (!links.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface-2/60 p-3">
      <div className="mb-2 text-sm font-semibold">{title}</div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            <ExternalLink href={l.url}>{l.label}</ExternalLink>
            {l.note && <span className="ml-1 text-xs text-muted">({l.note})</span>}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted">Links externos com parâmetros pré-preenchidos; alguns sites podem pedir para confirmar datas e passageiros. Preços e disponibilidade são do fornecedor.</p>
    </div>
  );
}

export function SourceInfo({ data }: { data: Pick<SearchApiResponse<unknown>, "available" | "sources" | "errors" | "notice"> }) {
  return (
    <div className="space-y-2">
      {!data.available ? (
        <Notice tone="warn" title="Consulta real indisponível">
          {data.notice}
        </Notice>
      ) : (
        data.notice && <Notice tone="info">{data.notice}</Notice>
      )}
      {data.errors.map((e) => (
        <Notice key={e} tone="error">
          {e}
        </Notice>
      ))}
      {data.sources.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs text-muted">
          {data.sources.map((s) => (
            <span key={s.provider} className="inline-flex flex-wrap items-center gap-1">
              <Badge tone="blue">{s.provider}</Badge> consultado em {fmtDateTime(s.queried_at)}
              {s.cached && <Badge>cache</Badge>} · {s.attribution}
              {s.notice && <span className="block w-full">{s.notice}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
