"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { LogoutButton } from "../LogoutButton";
import { LinkPending } from "../ui/LinkPending";

export type NavItem = { href: string; label: string; group: string };

export function AppShell({ nav, user, unread, children }: { nav: NavItem[]; user: { name: string; email: string }; unread: number; children: React.ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => {
    const [path, query] = href.split("?") as [string, string | undefined];
    if (path === "/") return pathname === "/";
    if (pathname !== path && !pathname.startsWith(`${path}/`)) return false;
    // Itens que diferem só pela categoria (ex.: Pessoas × Voluntários).
    const wanted = new URLSearchParams(query ?? "").get("categoria");
    return pathname !== path || wanted === search.get("categoria");
  };
  const groups = [...new Set(nav.map((n) => n.group))];

  const menu = (
    <nav aria-label="Menu principal" className="flex flex-col gap-3 p-3">
      {groups.map((g) => (
        <div key={g} className="flex flex-col gap-0.5">
          {g && <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g}</p>}
          {nav.filter((n) => n.group === g).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              // Páginas dinâmicas: pré-carregar todo o menu sobrecarrega o servidor e o banco.
              prefetch={false}
              onClick={() => setOpen(false)}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${isActive(item.href) ? "bg-brand-700 text-white" : "text-slate-700 hover:bg-slate-100"}`}
            >
              {item.label}
              <LinkPending />
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Pular para o conteúdo
      </a>
      <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white lg:block">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="font-semibold text-brand-900">Gestão de Obras</p>
          <p className="text-xs text-slate-500">Proposta técnica independente</p>
        </div>
        {menu}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <button
            type="button"
            className="rounded-md p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
            aria-expanded={open}
            aria-controls="menu-movel"
            onClick={() => setOpen(!open)}
          >
            <span className="sr-only">Abrir menu</span>
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M3 5h14v2H3zm0 4h14v2H3zm0 4h14v2H3z" /></svg>
          </button>
          <div className="ml-auto flex items-center gap-3">
            <Link href="/notificacoes" prefetch={false} className="relative rounded-md p-2 text-slate-700 hover:bg-slate-100" aria-label={`Notificações${unread ? ` (${unread} não lidas)` : ""}`}>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M10 2a6 6 0 00-6 6v3.6L2.3 14.3A1 1 0 003 16h14a1 1 0 00.7-1.7L16 11.6V8a6 6 0 00-6-6zm0 18a3 3 0 01-2.8-2h5.6A3 3 0 0110 20z" /></svg>
              {unread > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-[1.1rem] rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-[1.1rem] text-white">{unread > 99 ? "99+" : unread}</span>}
            </Link>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <LogoutButton variant="secondary" />
          </div>
        </header>
        {open && (
          <div id="menu-movel" className="border-b border-slate-200 bg-white lg:hidden">
            {menu}
          </div>
        )}
        <main id="conteudo" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
