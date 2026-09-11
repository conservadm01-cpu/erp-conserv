import type { KeyValueAdapter } from "./KeyValueAdapter";
import { SupabaseAdapter } from "./SupabaseAdapter";
import { WindowStorageAdapter } from "./WindowStorageAdapter";
import { LocalStorageAdapter } from "./LocalStorageAdapter";
import { MemoryAdapter } from "./MemoryAdapter";

export type { KeyValueAdapter, KeyValueEntry } from "./KeyValueAdapter";
export { SupabaseAdapter, WindowStorageAdapter, LocalStorageAdapter, MemoryAdapter };

/**
 * Ordem de preferência:
 *   1. Supabase direto (banco compartilhado da fábrica, leitura em lote)
 *   2. window.storage do ERP (quando embarcada no ERP)
 *   3. localStorage (modo autônomo/demonstração)
 *   4. memória (último recurso)
 */
export function resolveAdapter(): KeyValueAdapter {
  const supabase = SupabaseAdapter.fromEnv();
  if (supabase) return supabase;
  const erp = WindowStorageAdapter.detect();
  if (erp) return erp;
  if (typeof window !== "undefined" && LocalStorageAdapter.available()) return new LocalStorageAdapter();
  return new MemoryAdapter();
}
