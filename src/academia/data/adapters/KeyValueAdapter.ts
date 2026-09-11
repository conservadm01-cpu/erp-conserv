// =====================================================================
// DATABASE / FILE STORAGE — camada de persistência
// ---------------------------------------------------------------------
// A Academia não conversa diretamente com o Supabase: ela fala com este
// contrato. Trocar por uma API própria, Postgres via REST ou Prisma é
// implementar outra classe aqui — nada acima muda.
// =====================================================================

export interface KeyValueEntry {
  key: string;
  value: string;
}

export interface KeyValueAdapter {
  /** Nome exibido no painel admin (diagnóstico de ambiente). */
  readonly name: string;
  /** true quando a persistência é compartilhada entre todos os usuários. */
  readonly shared: boolean;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix: string): Promise<string[]>;
  /** Leitura em lote — é o que permite carregar o banco em 1 requisição. */
  entries(prefix: string): Promise<KeyValueEntry[]>;
  /** Escrita em lote — usada na carga inicial de conteúdo (seed). */
  setMany(entries: KeyValueEntry[]): Promise<void>;
  deleteMany(keys: string[]): Promise<void>;
}
