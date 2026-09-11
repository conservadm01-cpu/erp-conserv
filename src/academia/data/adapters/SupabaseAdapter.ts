import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { KeyValueAdapter, KeyValueEntry } from "./KeyValueAdapter";

const TABLE = "app_storage";

/**
 * Banco compartilhado da ConServ. Usa a mesma tabela do ERP
 * (app_storage), com todas as chaves prefixadas por `academia:` — os dois
 * sistemas convivem sem se atrapalhar.
 *
 * Diferente do window.storage do ERP, aqui existe leitura e escrita em
 * lote: o banco inteiro da Academia carrega em uma única requisição.
 */
export class SupabaseAdapter implements KeyValueAdapter {
  readonly name = "Supabase (app_storage)";
  readonly shared = true;

  constructor(private client: SupabaseClient) {}

  static fromEnv(): SupabaseAdapter | null {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    try {
      return new SupabaseAdapter(createClient(url, key, { auth: { persistSession: false } }));
    } catch {
      return null;
    }
  }

  private static escape(prefix: string): string {
    return prefix.replace(/[%_]/g, (m) => `\\${m}`);
  }

  async get(key: string) {
    const { data, error } = await this.client.from(TABLE).select("value").eq("key", key).maybeSingle();
    if (error) throw error;
    return data?.value ?? null;
  }

  async set(key: string, value: string) {
    const { error } = await this.client
      .from(TABLE)
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw error;
  }

  async delete(key: string) {
    const { error } = await this.client.from(TABLE).delete().eq("key", key);
    if (error) throw error;
  }

  async keys(prefix: string) {
    const { data, error } = await this.client.from(TABLE).select("key").like("key", `${SupabaseAdapter.escape(prefix)}%`);
    if (error) throw error;
    return (data ?? []).map((r) => r.key as string);
  }

  async entries(prefix: string): Promise<KeyValueEntry[]> {
    const pageSize = 1000;
    const out: KeyValueEntry[] = [];
    for (let page = 0; ; page += 1) {
      const { data, error } = await this.client
        .from(TABLE)
        .select("key, value")
        .like("key", `${SupabaseAdapter.escape(prefix)}%`)
        .order("key")
        .range(page * pageSize, page * pageSize + pageSize - 1);
      if (error) throw error;
      const rows = data ?? [];
      out.push(...rows.map((r) => ({ key: r.key as string, value: r.value as string })));
      if (rows.length < pageSize) break;
    }
    return out;
  }

  async setMany(entries: KeyValueEntry[]) {
    const updatedAt = new Date().toISOString();
    const chunkSize = 200;
    for (let i = 0; i < entries.length; i += chunkSize) {
      const rows = entries.slice(i, i + chunkSize).map((e) => ({ key: e.key, value: e.value, updated_at: updatedAt }));
      const { error } = await this.client.from(TABLE).upsert(rows, { onConflict: "key" });
      if (error) throw error;
    }
  }

  async deleteMany(keys: string[]) {
    const chunkSize = 200;
    for (let i = 0; i < keys.length; i += chunkSize) {
      const { error } = await this.client.from(TABLE).delete().in("key", keys.slice(i, i + chunkSize));
      if (error) throw error;
    }
  }
}
