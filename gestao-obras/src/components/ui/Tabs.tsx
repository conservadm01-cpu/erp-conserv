import Link from "next/link";
import { LinkPending } from "./LinkPending";

/** Abas por link (estado na URL, compatível com voltar/avançar). */
export function Tabs({ tabs, current, base }: { tabs: { id: string; label: string; count?: number }[]; current: string; base: string }) {
  return (
    <nav aria-label="Seções" className="mb-6 overflow-x-auto border-b border-slate-200">
      <ul className="flex min-w-max gap-1">
        {tabs.map((t) => (
          <li key={t.id}>
            <Link
              href={`${base}?aba=${t.id}`}
              prefetch={false}
              aria-current={t.id === current ? "page" : undefined}
              className={`inline-block border-b-2 px-4 py-2 text-sm font-medium ${t.id === current ? "border-brand-700 text-brand-900" : "border-transparent text-slate-600 hover:text-slate-900"}`}
            >
              {t.label}
              {t.count !== undefined && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">{t.count}</span>}
              <LinkPending />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
