import { useMemo, useSyncExternalStore } from "react";
import { db } from "../data/db";
import type { CollectionName, Schema } from "../data/schema";

const subscribe = (listener: () => void) => db.subscribe(listener);

/** Versão do banco — muda a cada gravação, disparando o re-render. */
export function useDbVersion(): number {
  return useSyncExternalStore(subscribe, () => db.getVersion(), () => db.getVersion());
}

export function useCollection<K extends CollectionName>(name: K): readonly Schema[K][] {
  useDbVersion();
  return db.list(name);
}

export function useRecord<K extends CollectionName>(name: K, id?: string): Schema[K] | undefined {
  useDbVersion();
  return db.byId(name, id);
}

/**
 * Consulta derivada: recalcula quando o banco muda ou quando as
 * dependências mudam. É assim que as telas leem dos repositórios sem
 * conhecer o banco.
 */
export function useQuery<T>(compute: () => T, deps: unknown[] = []): T {
  const version = useDbVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(compute, [version, ...deps]);
}

export function useDbStatus() {
  useDbVersion();
  return db.status();
}
