import type { KeyValueAdapter, KeyValueEntry } from "./KeyValueAdapter";

/**
 * Modo autônomo: a Academia funciona sem backend nenhum (demonstração,
 * treinamento offline, desenvolvimento). Os dados ficam só no navegador.
 */
export class LocalStorageAdapter implements KeyValueAdapter {
  readonly name = "Navegador (localStorage)";
  readonly shared = false;

  static available(): boolean {
    try {
      const probe = "__academia_probe__";
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
      return true;
    } catch {
      return false;
    }
  }

  async get(key: string) {
    return window.localStorage.getItem(key);
  }
  async set(key: string, value: string) {
    window.localStorage.setItem(key, value);
  }
  async delete(key: string) {
    window.localStorage.removeItem(key);
  }
  async keys(prefix: string) {
    const out: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefix)) out.push(k);
    }
    return out;
  }
  async entries(prefix: string): Promise<KeyValueEntry[]> {
    const keys = await this.keys(prefix);
    return keys.map((key) => ({ key, value: window.localStorage.getItem(key) ?? "" }));
  }
  async setMany(entries: KeyValueEntry[]) {
    for (const e of entries) window.localStorage.setItem(e.key, e.value);
  }
  async deleteMany(keys: string[]) {
    for (const k of keys) window.localStorage.removeItem(k);
  }
}
