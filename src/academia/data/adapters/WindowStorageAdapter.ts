import type { KeyValueAdapter, KeyValueEntry } from "./KeyValueAdapter";

interface WindowStorageApi {
  get(key: string, shared?: boolean): Promise<{ value: string } | null>;
  set(key: string, value: string, shared?: boolean): Promise<unknown>;
  delete(key: string, shared?: boolean): Promise<unknown>;
  list(prefix?: string, shared?: boolean): Promise<{ keys: string[] }>;
}

/**
 * Reaproveita o window.storage já instalado pelo ERP ConServ
 * (src/storage.js → tabela app_storage do Supabase). Serve de ponte
 * quando a Academia roda embarcada no ERP.
 */
export class WindowStorageAdapter implements KeyValueAdapter {
  readonly name = "ERP ConServ (window.storage)";
  readonly shared = true;

  constructor(private api: WindowStorageApi) {}

  static detect(): WindowStorageAdapter | null {
    const api = (globalThis as { storage?: WindowStorageApi }).storage;
    if (api && typeof api.get === "function" && typeof api.list === "function") return new WindowStorageAdapter(api);
    return null;
  }

  async get(key: string) {
    const row = await this.api.get(key, true);
    return row?.value ?? null;
  }
  async set(key: string, value: string) {
    await this.api.set(key, value, true);
  }
  async delete(key: string) {
    await this.api.delete(key, true);
  }
  async keys(prefix: string) {
    const res = await this.api.list(prefix, true);
    return res?.keys ?? [];
  }
  async entries(prefix: string): Promise<KeyValueEntry[]> {
    const keys = await this.keys(prefix);
    const out: KeyValueEntry[] = [];
    // Sem leitura em lote na API antiga: busca em grupos para não abrir
    // centenas de conexões ao mesmo tempo.
    const chunkSize = 25;
    for (let i = 0; i < keys.length; i += chunkSize) {
      const slice = keys.slice(i, i + chunkSize);
      const values = await Promise.all(slice.map((k) => this.get(k)));
      slice.forEach((key, idx) => {
        const value = values[idx];
        if (value != null) out.push({ key, value });
      });
    }
    return out;
  }
  async setMany(entries: KeyValueEntry[]) {
    const chunkSize = 20;
    for (let i = 0; i < entries.length; i += chunkSize) {
      await Promise.all(entries.slice(i, i + chunkSize).map((e) => this.set(e.key, e.value)));
    }
  }
  async deleteMany(keys: string[]) {
    const chunkSize = 20;
    for (let i = 0; i < keys.length; i += chunkSize) {
      await Promise.all(keys.slice(i, i + chunkSize).map((k) => this.delete(k)));
    }
  }
}
