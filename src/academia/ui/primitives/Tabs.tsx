import { cn } from "../../core/cn";
import { Icon } from "./Icon";

export interface TabItem {
  id: string;
  label: string;
  icon?: string;
  badge?: number;
}

export function Tabs({ items, active, onChange, className }: {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1 overflow-x-auto pb-1 -mx-1 px-1", className)} role="tablist">
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13.5px] font-semibold transition-colors border",
              isActive
                ? "bg-navy text-linen-50 border-navy"
                : "bg-linen-50 text-ink-600 border-sand/70 hover:bg-linen-100",
            )}
          >
            {item.icon && <Icon name={item.icon} size={15} />}
            {item.label}
            {item.badge !== undefined && item.badge > 0 && (
              <span className={cn("ml-0.5 px-1.5 py-0.5 rounded-full text-[10.5px] font-bold", isActive ? "bg-linen-50/20" : "bg-copper/15 text-copper-600")}>
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
