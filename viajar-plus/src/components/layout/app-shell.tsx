"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, Moon, Sun, X, Plane } from "lucide-react";
import { MOBILE_NAV, NAV, isActive } from "./nav";
import { useTrip } from "@/lib/trips/context";
import { dataMode } from "@/lib/data";
import { CURRENCIES } from "@/lib/format";
import { cn } from "@/lib/cn";
import { NotificationBell } from "@/components/notifications/bell";

const BARE = ["/login", "/auth", "/privacidade", "/termos", "/convite"];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  if (BARE.some((p) => pathname.startsWith(p))) return <main className="min-h-dvh">{children}</main>;

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[260px_1fr]">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[70] focus:rounded-lg focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg">
        Pular para o conteúdo
      </a>
      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-40 w-[260px] -translate-x-full overflow-y-auto border-r border-line bg-surface transition md:sticky md:top-0 md:h-dvh md:translate-x-0",
          open && "translate-x-0 shadow-2xl",
        )}
        aria-label="Menu principal"
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-glacier-500 to-glacier-900 text-white">
              <Plane className="h-5 w-5" aria-hidden />
            </span>
            <span className="font-display text-2xl font-bold tracking-tight">
              VIAJAR<span className="text-sunset-500">+</span>
            </span>
          </Link>
          <button className="rounded-lg p-1.5 hover:bg-surface-2 md:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="px-3 pb-6">
          <ul className="space-y-0.5">
            {NAV.map((n) => {
              const active = isActive(pathname, n.href);
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                      active ? "bg-accent text-accent-fg" : "text-muted hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    <n.icon className="h-4 w-4" aria-hidden />
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="px-5 pb-6 text-xs text-muted">
          <Link href="/privacidade" className="hover:underline">Privacidade</Link> · <Link href="/termos" className="hover:underline">Termos</Link>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setOpen(false)} aria-hidden />}

      <div className="min-w-0">
        <TopBar onMenu={() => setOpen(true)} />
        {dataMode() === "local" && (
          <div className="no-print border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
            Modo demonstração local: os dados ficam apenas neste navegador. Configure o Supabase para login, sincronização e compartilhamento.
          </div>
        )}
        <main id="conteudo" className="mx-auto w-full max-w-7xl px-4 pb-28 pt-6 md:px-8 md:pb-12">
          {children}
        </main>
      </div>

      <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface/95 backdrop-blur md:hidden" aria-label="Atalhos">
        {MOBILE_NAV.map((href) => {
          const item = NAV.find((n) => n.href === href)!;
          const active = isActive(pathname, href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 py-2 text-[11px]", active ? "text-accent" : "text-muted")}>
              <item.icon className="h-5 w-5" aria-hidden />
              {item.label.split(" ")[0]}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { trips, trip, select, displayCurrency, setDisplayCurrency } = useTrip();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <header className="no-print sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-bg/90 px-4 py-2.5 backdrop-blur md:px-8">
      <button className="rounded-lg p-2 hover:bg-surface-2 md:hidden" onClick={onMenu} aria-label="Abrir menu">
        <Menu className="h-5 w-5" />
      </button>
      <label className="sr-only" htmlFor="trip-select">Viagem ativa</label>
      <select
        id="trip-select"
        className="h-9 w-0 min-w-0 flex-1 truncate rounded-lg border border-line bg-surface px-2 text-sm md:w-auto md:max-w-md md:flex-none"
        value={trip?.id ?? ""}
        onChange={(e) => select(e.target.value || null)}
      >
        {!trips.length && <option value="">Nenhuma viagem</option>}
        {trips.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} — {t.destination}
          </option>
        ))}
      </select>
      <div className="ml-auto flex shrink-0 items-center gap-1 md:gap-2">
        <label className="sr-only" htmlFor="cur-select">Moeda de exibição</label>
        <select
          id="cur-select"
          title="Moeda de exibição dos totais"
          className="h-9 w-20 rounded-lg border border-line bg-surface px-1 text-sm md:w-auto md:px-2"
          value={displayCurrency ?? ""}
          onChange={(e) => setDisplayCurrency(e.target.value || null)}
        >
          <option value="">{trip ? `${trip.currency} (base)` : "Moeda base"}</option>
          {CURRENCIES.filter((c) => c !== trip?.currency).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <NotificationBell />
        <button
          className="rounded-lg p-2 hover:bg-surface-2"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          aria-label={mounted && resolvedTheme === "dark" ? "Usar tema claro" : "Usar tema escuro"}
        >
          {mounted && resolvedTheme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>
      </div>
    </header>
  );
}
