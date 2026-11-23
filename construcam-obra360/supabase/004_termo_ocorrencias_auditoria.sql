-- Construcam Obra 360 — 004: termo de ciência, ocorrências com preservação,
-- registro de acessos aos vídeos e retenção de 60 dias.
--
-- Rode depois do 003. Pode ser executado mais de uma vez.
--
-- IMPORTANTE: a partir daqui os links dos vídeos são emitidos somente pelo
-- servidor do app (rota /api/videos/assinar, com a SUPABASE_SERVICE_ROLE_KEY),
-- que confere a permissão e registra o acesso. Por isso a leitura direta do
-- bucket pelo navegador é removida no fim deste script.

-- ------------------------------------------------------------ funções base
create or replace function public.obra_da_gravacao(g uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select obra_id from gravacoes where id = g
$$;

create or replace function public.pode_acompanhar_gravacao(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(pode_acompanhar_obra(obra_da_gravacao(g)), false)
$$;

-- ------------------------------------------------------------ termo de ciência
-- Mude a versão quando o texto do termo mudar: todos precisarão aceitar de novo.
create or replace function public.termo_versao_atual() returns text
language sql immutable as $$ select '2026-11' $$;

create table if not exists public.termos_aceite (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  email text not null default public.meu_email(),
  versao text not null,
  user_agent text,
  aceito_em timestamptz not null default now(),
  unique (user_id, versao)
);
create index if not exists termos_aceite_email_idx on public.termos_aceite (email);

create or replace function public.aceitou_termo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from termos_aceite where user_id = auth.uid() and versao = termo_versao_atual())
$$;

alter table public.termos_aceite enable row level security;
drop policy if exists "termos_select" on public.termos_aceite;
drop policy if exists "termos_insert" on public.termos_aceite;
-- A pessoa vê os próprios aceites; a administração vê os de quem tem vínculo no condomínio.
create policy "termos_select" on public.termos_aceite for select to authenticated using (
  user_id = auth.uid()
  or exists (select 1 from public.membros m where m.email = termos_aceite.email
             and public.eh_admin_condominio(public.condominio_do_membro(m)))
);
create policy "termos_insert" on public.termos_aceite for insert to authenticated with check (
  user_id = auth.uid() and email = public.meu_email() and versao = public.termo_versao_atual()
);

-- Gravar agora exige o termo aceito.
drop policy if exists "gravacoes_insert" on public.gravacoes;
create policy "gravacoes_insert" on public.gravacoes for insert to authenticated with check (
  profissional_id = auth.uid()
  and obra_id is not null
  and public.eh_profissional_obra(obra_id)
  and exists (select 1 from public.obras ob where ob.id = obra_id and ob.status = 'ativa')
  and public.aceitou_termo()
);

-- ------------------------------------------------------------ ocorrências
alter table public.ocorrencias add column if not exists obra_id uuid references public.obras(id) on delete cascade;
alter table public.ocorrencias add column if not exists segmento_inicio integer;
alter table public.ocorrencias add column if not exists segmento_fim integer;
alter table public.ocorrencias add column if not exists status text not null default 'aberta';
alter table public.ocorrencias add column if not exists resolucao text;
alter table public.ocorrencias add column if not exists resolvido_por uuid references auth.users(id);
alter table public.ocorrencias add column if not exists resolvido_em timestamptz;
alter table public.ocorrencias add column if not exists solicitado_email text default public.meu_email();
alter table public.ocorrencias alter column solicitado_por set default auth.uid();
alter table public.ocorrencias alter column preservada set default true;
alter table public.ocorrencias drop constraint if exists ocorrencias_status_check;
alter table public.ocorrencias add constraint ocorrencias_status_check check (status in ('aberta', 'resolvida'));
alter table public.ocorrencias drop constraint if exists ocorrencias_segmentos_check;
alter table public.ocorrencias add constraint ocorrencias_segmentos_check
  check (segmento_inicio is null or (segmento_inicio >= 0 and coalesce(segmento_fim, segmento_inicio) >= segmento_inicio));
create index if not exists ocorrencias_obra_idx on public.ocorrencias (obra_id, created_at desc);
create index if not exists ocorrencias_gravacao_idx on public.ocorrencias (gravacao_id);

drop policy if exists "ocorrencias_select" on public.ocorrencias;
drop policy if exists "ocorrencias_insert" on public.ocorrencias;
drop policy if exists "ocorrencias_update" on public.ocorrencias;
create policy "ocorrencias_select" on public.ocorrencias for select to authenticated
using (public.pode_ver_gravacao(gravacao_id::text));
-- Proprietário ou administração registram; a ocorrência nasce aberta e preservada.
create policy "ocorrencias_insert" on public.ocorrencias for insert to authenticated with check (
  solicitado_por = auth.uid()
  and solicitado_email = public.meu_email()
  and obra_id = public.obra_da_gravacao(gravacao_id)
  and public.pode_acompanhar_gravacao(gravacao_id)
  and status = 'aberta' and preservada = true
  and resolvido_por is null and resolvido_em is null and resolucao is null
);
-- Só a administração do condomínio resolve ou libera a preservação.
create policy "ocorrencias_update" on public.ocorrencias for update to authenticated
using (public.eh_admin_condominio(public.condominio_da_obra(obra_id)))
with check (public.eh_admin_condominio(public.condominio_da_obra(obra_id)) and obra_id = public.obra_da_gravacao(gravacao_id));

-- ------------------------------------------------------------ registro de acessos
-- Escrito somente pelo servidor (service role). Leitura: administração e proprietário.
create table if not exists public.acessos_video (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  email text,
  gravacao_id uuid references public.gravacoes(id) on delete cascade,
  obra_id uuid references public.obras(id) on delete cascade,
  tipo text not null check (tipo in ('historico', 'ao_vivo')),
  segmentos integer[],
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists acessos_obra_idx on public.acessos_video (obra_id, created_at desc);
create index if not exists acessos_user_gravacao_idx on public.acessos_video (user_id, gravacao_id, tipo, created_at desc);

alter table public.acessos_video enable row level security;
drop policy if exists "acessos_select" on public.acessos_video;
create policy "acessos_select" on public.acessos_video for select to authenticated using (
  user_id = auth.uid() or (obra_id is not null and public.pode_acompanhar_obra(obra_id))
);

-- ------------------------------------------------------------ retenção
-- Trechos com mais de N dias que NÃO estão cobertos por ocorrência preservada.
-- (segmento_inicio nulo = preserva a gravação inteira.)
create or replace function public.trechos_expirados(dias integer default 60, limite integer default 500)
returns table (id uuid, gravacao_id uuid, caminho_storage text)
language sql stable security definer set search_path = public as $$
  select a.id, a.gravacao_id, a.caminho_storage
  from arquivos_video a
  where coalesce(a.inicio_segmento, a.created_at) < now() - make_interval(days => dias)
    and not exists (
      select 1 from ocorrencias o
      where o.gravacao_id = a.gravacao_id and o.preservada
        and (o.segmento_inicio is null
             or a.numero_segmento between o.segmento_inicio and coalesce(o.segmento_fim, o.segmento_inicio))
    )
  order by coalesce(a.inicio_segmento, a.created_at)
  limit limite
$$;

-- Gravações sem nenhum trecho restante passam a 'expirada' (o registro fica).
create or replace function public.marcar_gravacoes_expiradas(ids uuid[]) returns integer
language sql volatile security definer set search_path = public as $$
  with u as (
    update gravacoes g set status = 'expirada'
    where g.id = any(ids) and g.status <> 'expirada'
      and not exists (select 1 from arquivos_video a where a.gravacao_id = g.id)
    returning 1
  ) select count(*)::integer from u
$$;

revoke all on function public.trechos_expirados(integer, integer) from public;
revoke all on function public.marcar_gravacoes_expiradas(uuid[]) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on function public.trechos_expirados(integer, integer) from anon, authenticated;
    revoke all on function public.marcar_gravacoes_expiradas(uuid[]) from anon, authenticated;
  end if;
end $$;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.trechos_expirados(integer, integer) to service_role;
    grant execute on function public.marcar_gravacoes_expiradas(uuid[]) to service_role;
  end if;
end $$;

-- ------------------------------------------------------------ Storage
-- Leitura dos vídeos só pelo servidor do app (service role ignora RLS).
drop policy if exists "obras_videos_select" on storage.objects;
drop policy if exists "worker_read_own_video" on storage.objects;
