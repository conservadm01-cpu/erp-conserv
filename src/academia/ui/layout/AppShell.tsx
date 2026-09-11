import React, { useState } from "react";
import { cn } from "../../core/cn";
import { firstName } from "../../core/cn";
import { Icon } from "../primitives/Icon";
import { Avatar } from "../primitives/Avatar";
import { Link, useRouter } from "../../router/Router";
import { useAuth } from "../../auth/AuthContext";
import { MAIN_NAV, ADMIN_NAV, type NavItem } from "./navigation";
import { xpEngine } from "../../engines/gamification/XpEngine";
import { notificationRepo, settingsRepo } from "../../data/repositories";
import { useQuery } from "../../state/useCollection";
import { ProgressBar } from "../primitives/Progress";
import { Button } from "../primitives/Button";

function isActive(path: string, to: string): boolean {
  if (to === "/") return path === "/";
  if (to === "/admin") return path === "/admin";
  return path === to || path.startsWith(`${to}/`);
}

function NavLink({ item, active, onNavigate, compact }: { item: NavItem; active: boolean; onNavigate?: () => void; compact?: boolean }) {
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-semibold transition-colors",
        active ? "bg-linen-50 text-navy-900 shadow-card" : "text-linen-200/90 hover:bg-linen-50/10 hover:text-linen-50",
        compact && "py-2 text-[13.5px]",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon name={item.icon} size={18} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function AppShell({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const { path, navigate } = useRouter();
  const { employee, role, logout, can } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const settings = useQuery(() => settingsRepo.get());
  const level = useQuery(() => (employee ? xpEngine.level(employee.id) : null), [employee?.id]);
  const unread = useQuery(() => (employee ? notificationRepo.unreadCount(employee.id, role ?? undefined) : 0), [employee?.id, role]);

  const nav = admin ? ADMIN_NAV : MAIN_NAV;
  const mobileNav = admin ? ADMIN_NAV.slice(0, 4) : MAIN_NAV.filter((i) => i.mobile);

  return (
    <div className="min-h-[100dvh] flex bg-linen">
      {/* ---------------- Sidebar (desktop) ---------------- */}
      <aside className="hidden lg:flex w-[272px] shrink-0 flex-col bg-navy-900 sticky top-0 h-[100dvh] no-print">
        <div className="p-5 border-b border-linen-50/10">
          <Link to="/" className="block">
            <div className="flex items-center gap-2.5">
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-copper text-linen-50 font-bold text-lg">A</span>
              <div>
                <div className="text-linen-50 font-bold leading-tight">{settings.brandName}</div>
                <div className="text-[11px] text-sand-300/90">{settings.tagline}</div>
              </div>
            </div>
          </Link>
        </div>

        {employee && (
          <div className="p-4 border-b border-linen-50/10">
            <Link to="/perfil" className="flex items-center gap-3">
              <Avatar name={employee.name} photoUrl={employee.photoUrl} size={42} />
              <div className="min-w-0">
                <div className="text-linen-50 text-[14px] font-semibold truncate">{firstName(employee.name)}</div>
                <div className="text-[11.5px] text-sand-300/90 truncate">{employee.cargo}</div>
              </div>
            </Link>
            {level && (
              <div className="mt-3">
                <div className="flex justify-between text-[11px] text-sand-300 mb-1">
                  <span>Nível {level.level} · {level.name}</span>
                  <span className="tabular-nums">{level.xp} XP</span>
                </div>
                <div className="h-1.5 rounded-full bg-linen-50/15 overflow-hidden">
                  <div className="h-full bg-copper-300 rounded-full transition-[width] duration-500" style={{ width: `${level.progressPct}%` }} />
                </div>
              </div>
            )}
          </div>
        )}

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {nav.map((item) => (
            <NavLink key={item.to} item={item} active={isActive(path, item.to)} compact={admin} />
          ))}
        </nav>

        <div className="p-3 border-t border-linen-50/10 space-y-1">
          <Link
            to="/risco"
            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[14px] font-bold bg-alert/90 text-white hover:bg-alert transition-colors"
          >
            <Icon name="siren" size={18} />
            Eu vi um risco
          </Link>
          {can("admin.access") && (
            <Link
              to={admin ? "/" : "/admin"}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold text-linen-200/90 hover:bg-linen-50/10"
            >
              <Icon name={admin ? "arrow-left" : "settings"} size={17} />
              {admin ? "Voltar para a Academia" : "Painel administrativo"}
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/");
            }}
            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-semibold text-linen-200/70 hover:bg-linen-50/10"
          >
            <Icon name="logout" size={17} />
            Sair
          </button>
        </div>
      </aside>

      {/* ---------------- Conteúdo ---------------- */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar (mobile/tablet) */}
        <header className="lg:hidden sticky top-0 z-30 bg-navy-900 text-linen-50 no-print">
          <div className="flex items-center gap-3 px-4 h-14">
            <Link to="/" className="flex items-center gap-2 min-w-0">
              <span className="grid place-items-center w-8 h-8 rounded-lg bg-copper font-bold">A</span>
              <span className="font-bold truncate text-[15px]">{admin ? "Admin ConServ" : settings.brandName}</span>
            </Link>
            <div className="ml-auto flex items-center gap-1">
              <Link to="/notificacoes" className="relative p-2 rounded-lg hover:bg-linen-50/10" aria-label="Notificações">
                <Icon name="info" size={20} />
                {unread > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-copper-300" />}
              </Link>
              <button type="button" onClick={() => setMenuOpen(true)} className="p-2 rounded-lg hover:bg-linen-50/10" aria-label="Abrir menu">
                <Icon name="menu" size={22} />
              </button>
            </div>
          </div>
          {level && !admin && (
            <div className="px-4 pb-2">
              <div className="flex justify-between text-[11px] text-sand-300 mb-1">
                <span>Nível {level.level} · {level.name}</span>
                <span className="tabular-nums">{level.xp} XP{level.xpToNext ? ` · faltam ${level.xpToNext}` : ""}</span>
              </div>
              <div className="h-1.5 rounded-full bg-linen-50/15 overflow-hidden">
                <div className="h-full bg-copper-300 rounded-full" style={{ width: `${level.progressPct}%` }} />
              </div>
            </div>
          )}
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-5 sm:py-7 pb-24 lg:pb-10 max-w-[1180px] w-full mx-auto">
          {children}
        </main>

        {/* Bottom navigation (celular) */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-linen-50/95 backdrop-blur border-t border-sand/70 no-print">
          <div className="grid grid-cols-5">
            {mobileNav.map((item) => {
              const active = isActive(path, item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-semibold",
                    active ? "text-navy" : "text-ink-400",
                  )}
                >
                  <Icon name={item.icon} size={21} />
                  <span className="truncate max-w-[70px]">{item.shortLabel ?? item.label}</span>
                </Link>
              );
            })}
            <Link to="/risco" className="flex flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-semibold text-alert">
              <Icon name="siren" size={21} />
              Risco
            </Link>
          </div>
          <div className="h-[env(safe-area-inset-bottom)]" />
        </nav>
      </div>

      {/* ---------------- Drawer (celular) ---------------- */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 no-print">
          <div className="absolute inset-0 bg-navy-900/60" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-[84%] max-w-[320px] bg-navy-900 flex flex-col animate-fade-up">
            <div className="flex items-center justify-between p-4 border-b border-linen-50/10">
              <span className="text-linen-50 font-bold">Menu</span>
              <button type="button" onClick={() => setMenuOpen(false)} className="p-1.5 rounded-lg text-linen-200 hover:bg-linen-50/10" aria-label="Fechar menu">
                <Icon name="x" size={20} />
              </button>
            </div>
            {employee && (
              <div className="p-4 border-b border-linen-50/10 flex items-center gap-3">
                <Avatar name={employee.name} photoUrl={employee.photoUrl} size={40} />
                <div className="min-w-0">
                  <div className="text-linen-50 text-[14px] font-semibold truncate">{employee.name}</div>
                  <div className="text-[11.5px] text-sand-300/90 truncate">{employee.cargo}</div>
                </div>
              </div>
            )}
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {(admin ? ADMIN_NAV : MAIN_NAV).map((item) => (
                <NavLink key={item.to} item={item} active={isActive(path, item.to)} onNavigate={() => setMenuOpen(false)} />
              ))}
            </nav>
            <div className="p-3 border-t border-linen-50/10 space-y-2">
              {can("admin.access") && (
                <Button
                  variant="secondary"
                  block
                  icon={admin ? "arrow-left" : "settings"}
                  onClick={() => {
                    setMenuOpen(false);
                    navigate(admin ? "/" : "/admin");
                  }}
                >
                  {admin ? "Voltar para a Academia" : "Painel administrativo"}
                </Button>
              )}
              <Button
                variant="ghost"
                block
                icon="logout"
                className="text-linen-200/80"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                  navigate("/");
                }}
              >
                Sair
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Cabeçalho padrão das páginas. */
export function PageHeader({ title, subtitle, icon, action, back }: {
  title: string;
  subtitle?: string;
  icon?: string;
  action?: React.ReactNode;
  back?: { to: string; label: string };
}) {
  return (
    <div className="mb-5">
      {back && (
        <Link to={back.to} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-600 hover:text-navy mb-2">
          <Icon name="arrow-left" size={15} />
          {back.label}
        </Link>
      )}
      <div className="flex items-start gap-3">
        {icon && (
          <span className="shrink-0 grid place-items-center w-11 h-11 rounded-xl bg-navy text-linen-50">
            <Icon name={icon} size={22} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] sm:text-[26px] font-bold leading-tight">{title}</h1>
          {subtitle && <p className="text-[14px] text-ink-600 mt-1 leading-snug">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}

export { ProgressBar };
