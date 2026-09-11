/** Junta classes condicionais (substituto mínimo do clsx). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function pct(value: number): string {
  return `${Math.round(value)}%`;
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => p.length > 2);
  if (parts.length === 0) return name.slice(0, 2).toUpperCase();
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : parts[0][1] ?? "";
  return (first + last).toUpperCase();
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
