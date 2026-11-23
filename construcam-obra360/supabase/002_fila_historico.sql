-- Migração para bancos criados com a versão original do schema.sql.
-- (Instalações novas: basta rodar o schema.sql atualizado, que já inclui isto.)
-- Pode ser executado mais de uma vez sem erro.

alter table public.arquivos_video add column if not exists inicio_segmento timestamptz;
alter table public.arquivos_video add column if not exists duracao_ms integer;

create index if not exists gravacoes_profissional_inicio_idx
  on public.gravacoes (profissional_id, inicio desc);
