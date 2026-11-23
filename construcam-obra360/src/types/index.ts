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

export type Ocorrencia = {
  id: string; gravacao_id: string; obra_id: string | null; descricao: string;
  segmento_inicio: number | null; segmento_fim: number | null;
  status: "aberta" | "resolvida"; preservada: boolean; resolucao: string | null;
  solicitado_email: string | null; created_at: string; resolvido_em: string | null;
};
export type AcessoVideo = { id: number; email: string | null; gravacao_id: string; obra_id: string | null; tipo: "historico" | "ao_vivo"; segmentos: number[] | null; created_at: string };
