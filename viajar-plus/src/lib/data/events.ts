import type { TableName } from "@/lib/types";

type Listener = () => void;
const listeners = new Map<TableName, Set<Listener>>();

/** Assina mudanças numa tabela; retorna função para cancelar. */
export function subscribe(table: TableName, fn: Listener): () => void {
  let set = listeners.get(table);
  if (!set) listeners.set(table, (set = new Set()));
  set.add(fn);
  return () => set!.delete(fn);
}

export function notify(table: TableName): void {
  listeners.get(table)?.forEach((fn) => fn());
}
