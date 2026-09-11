import { cn } from "../../core/cn";
import { initialsOf } from "../../core/cn";

export function Avatar({ name, photoUrl, size = 40, className }: {
  name: string;
  photoUrl?: string;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size, fontSize: Math.max(11, size * 0.36) };
  if (photoUrl) {
    return <img src={photoUrl} alt={name} style={style} className={cn("rounded-full object-cover border border-sand", className)} />;
  }
  return (
    <span
      style={style}
      aria-hidden="true"
      className={cn(
        "inline-grid place-items-center rounded-full bg-navy text-linen-50 font-bold border border-navy-800/30 shrink-0",
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
