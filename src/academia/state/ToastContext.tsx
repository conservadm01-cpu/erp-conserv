import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { cn } from "../core/cn";
import { Icon } from "../ui/primitives/Icon";
import type { BadgeGrant } from "../engines/gamification/BadgeEngine";

export interface ToastItem {
  id: string;
  title: string;
  body?: string;
  tone: "xp" | "badge" | "info" | "erro" | "sucesso";
  icon?: string;
}

interface ToastValue {
  push: (toast: Omit<ToastItem, "id">) => void;
  xp: (amount: number, reason?: string) => void;
  badges: (grants: BadgeGrant[]) => void;
  levelUp: (levelName: string) => void;
  error: (message: string) => void;
  success: (message: string, body?: string) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = `T${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    setItems((current) => [...current.slice(-3), { ...toast, id }]);
    window.setTimeout(() => setItems((current) => current.filter((t) => t.id !== id)), toast.tone === "badge" ? 6500 : 4200);
  }, []);

  const value = useMemo<ToastValue>(() => ({
    push,
    xp: (amount, reason) => {
      if (amount <= 0) return;
      push({ title: `+${amount} XP`, body: reason, tone: "xp", icon: "zap" });
    },
    badges: (grants) => {
      for (const grant of grants) {
        push({ title: `Badge: ${grant.badge.name}`, body: grant.badge.description, tone: "badge", icon: grant.badge.icon });
      }
    },
    levelUp: (levelName) => push({ title: `Novo nível: ${levelName}!`, body: "Seu esforço apareceu no seu perfil.", tone: "badge", icon: "trophy" }),
    error: (message) => push({ title: "Algo não deu certo", body: message, tone: "erro", icon: "alert" }),
    success: (message, body) => push({ title: message, body, tone: "sucesso", icon: "check-circle" }),
  }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-20 sm:bottom-6 right-3 sm:right-6 z-[60] flex flex-col gap-2 pointer-events-none no-print" aria-live="polite">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto animate-fade-up shadow-lift rounded-xl border px-4 py-3 flex items-start gap-2.5 max-w-[330px]",
              item.tone === "xp" && "bg-navy text-linen-50 border-navy-800",
              item.tone === "badge" && "bg-copper text-linen-50 border-copper-600",
              item.tone === "sucesso" && "bg-jade text-linen-50 border-jade-600",
              item.tone === "erro" && "bg-alert text-white border-alert",
              item.tone === "info" && "bg-linen-50 text-ink border-sand",
            )}
          >
            <Icon name={item.icon ?? "info"} size={18} className="shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="font-bold text-[14px] leading-snug">{item.title}</div>
              {item.body && <div className="text-[12.5px] opacity-90 leading-snug mt-0.5">{item.body}</div>}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast precisa estar dentro de <ToastProvider>");
  return value;
}
