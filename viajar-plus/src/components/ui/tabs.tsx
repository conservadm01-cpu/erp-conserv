"use client";
import * as T from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Tabs({ tabs, value, onValueChange, defaultValue, className }: { tabs: { value: string; label: ReactNode; content: ReactNode }[]; value?: string; onValueChange?: (v: string) => void; defaultValue?: string; className?: string }) {
  return (
    <T.Root value={value} onValueChange={onValueChange} defaultValue={defaultValue ?? tabs[0]?.value} className={className}>
      <T.List className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface-2 p-1" aria-label="Seções">
        {tabs.map((t) => (
          <T.Trigger
            key={t.value}
            value={t.value}
            className={cn("whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition data-[state=active]:bg-surface data-[state=active]:text-fg data-[state=active]:shadow-sm")}
          >
            {t.label}
          </T.Trigger>
        ))}
      </T.List>
      {tabs.map((t) => (
        <T.Content key={t.value} value={t.value} className="min-w-0">
          {t.content}
        </T.Content>
      ))}
    </T.Root>
  );
}
