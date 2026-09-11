import type { KeyValueAdapter, KeyValueEntry } from "./KeyValueAdapter";

/** Usado em testes e quando nenhuma persistência está disponível. */
export class MemoryAdapter implements KeyValueAdapter {
  readonly name = "Memória (sessão atual)";
  readonly shared = false;
  private store = new Map<string, string>();

  async get(key: string) {
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.store.set(key, value);
  }
  async delete(key: string) {
    this.store.delete(key);
  }
  async keys(prefix: string) {
    return [...this.store.keys()].filter((k) => k.startsWith(prefix));
  }
  async entries(prefix: string): Promise<KeyValueEntry[]> {
    return [...this.store.entries()].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => ({ key, value }));
  }
  async setMany(entries: KeyValueEntry[]) {
    for (const e of entries) this.store.set(e.key, e.value);
  }
  async deleteMany(keys: string[]) {
    for (const k of keys) this.store.delete(k);
  }
}
