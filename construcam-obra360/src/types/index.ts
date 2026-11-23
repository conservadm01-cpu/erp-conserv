export type Papel = "admin" | "proprietario" | "profissional";
export type RecordingStatus = "iniciada" | "finalizada" | "pausada" | "falha";

export type Condominio = { id: string; nome: string; cidade: string | null };
export type Unidade = { id: string; condominio_id: string; bloco: string; identificador: string };
export type Obra = { id: string; unidade_id: string; descricao: string | null; empresa: string | null; status: string; created_at: string };
export type Membro = {
  id: string; email: string; nome: string | null; papel: Papel;
  condominio_id: string | null; unidade_id: string | null; obra_id: string | null;
};
export type ObraDetalhada = Obra & { unidade: Unidade | null; condominio: Condominio | null };

export const nomeUnidade = (u: Pick<Unidade, "bloco" | "identificador"> | null | undefined) =>
  !u ? "—" : u.bloco ? `Bloco ${u.bloco} · Apto. ${u.identificador}` : `Apto. ${u.identificador}`;
