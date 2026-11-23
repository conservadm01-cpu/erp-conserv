-- Construcam Obra 360 — 003: condomínios, unidades, obras e acesso por papel.
--
-- Rode DEPOIS do schema.sql (instalação nova) ou do 002 (instalação antiga).
-- Pode ser executado mais de uma vez.
--
-- Modelo de acesso (tudo por e-mail, então dá para vincular alguém antes
-- mesmo de a pessoa ter conta):
--   plataforma_admins  → cria condomínios e enxerga todos.
--   membros 'admin'        + condominio_id → administra aquele condomínio.
--   membros 'proprietario' + unidade_id    → acompanha as obras da unidade.
--   membros 'profissional' + obra_id       → grava naquela obra (se ativa).
--
-- Depois de rodar, cadastre o primeiro administrador da plataforma:
--   insert into public.plataforma_admins (email) values ('seu-email@exemplo.com');

-- ---------------------------------------------------------------- tabelas
create table if not exists public.plataforma_admins (
  email text primary key check (email = lower(trim(email))),
  created_at timestamptz not null default now()
);

create table if not exists public.condominios (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) > 0),
  cidade text,
  created_at timestamptz not null default now()
);

create table if not exists public.unidades (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  bloco text not null default '',
  identificador text not null check (length(trim(identificador)) > 0),
  created_at timestamptz not null default now(),
  unique (condominio_id, bloco, identificador)
);

-- obras passa a pertencer a uma unidade; condominio/apartamento em texto
-- ficam apenas como legado da versão inicial.
alter table public.obras add column if not exists unidade_id uuid references public.unidades(id) on delete cascade;
alter table public.obras alter column condominio drop not null;
alter table public.obras alter column apartamento drop not null;
create index if not exists obras_unidade_idx on public.obras (unidade_id);
create index if not exists gravacoes_obra_inicio_idx on public.gravacoes (obra_id, inicio desc);

create table if not exists public.membros (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(trim(email)) and email like '%_@_%'),
  nome text,
  papel text not null check (papel in ('admin', 'proprietario', 'profissional')),
  condominio_id uuid references public.condominios(id) on delete cascade,
  unidade_id uuid references public.unidades(id) on delete cascade,
  obra_id uuid references public.obras(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (
       (papel = 'admin'        and condominio_id is not null and unidade_id is null and obra_id is null)
    or (papel = 'proprietario' and unidade_id is not null and condominio_id is null and obra_id is null)
    or (papel = 'profissional' and obra_id is not null and condominio_id is null and unidade_id is null)
  )
);
create unique index if not exists membros_unico
  on public.membros (email, papel, coalesce(condominio_id, unidade_id, obra_id));
create index if not exists membros_email_idx on public.membros (email);

-- ---------------------------------------------------------------- funções
-- SECURITY DEFINER: consultam as tabelas sem passar pelo RLS, o que evita
-- recursão nas políticas. Todas só respondem sobre o usuário atual.
create or replace function public.meu_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

create or replace function public.eh_plataforma_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from plataforma_admins where email = meu_email() and email <> '')
$$;

create or replace function public.condominio_da_unidade(u uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select condominio_id from unidades where id = u
$$;

create or replace function public.condominio_da_obra(o uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select un.condominio_id from obras ob join unidades un on un.id = ob.unidade_id where ob.id = o
$$;

create or replace function public.eh_admin_condominio(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select c is not null and (
    eh_plataforma_admin()
    or exists (select 1 from membros where papel = 'admin' and condominio_id = c and email = meu_email())
  )
$$;

create or replace function public.eh_proprietario_unidade(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros where papel = 'proprietario' and unidade_id = u and email = meu_email())
$$;

create or replace function public.eh_profissional_obra(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros where papel = 'profissional' and obra_id = o and email = meu_email())
$$;

-- Admin do condomínio ou proprietário da unidade: acompanha todas as
-- gravações da obra. (Profissionais veem só as próprias gravações.)
create or replace function public.pode_acompanhar_obra(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from obras ob
    where ob.id = o
      and (eh_admin_condominio(condominio_da_obra(ob.id)) or eh_proprietario_unidade(ob.unidade_id))
  )
$$;

create or replace function public.pode_ver_obra(o uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select pode_acompanhar_obra(o) or eh_profissional_obra(o)
$$;

create or replace function public.participa_unidade(u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select eh_admin_condominio(condominio_da_unidade(u))
      or eh_proprietario_unidade(u)
      or exists (select 1 from obras ob where ob.unidade_id = u and eh_profissional_obra(ob.id))
$$;

create or replace function public.participa_condominio(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select eh_admin_condominio(c) or exists (
    select 1 from membros m
    where m.email = meu_email()
      and (condominio_da_unidade(m.unidade_id) = c or condominio_da_obra(m.obra_id) = c)
  )
$$;

-- Recebe texto porque é usada com o nome da pasta no Storage.
create or replace function public.pode_ver_gravacao(g text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from gravacoes x
    where x.id::text = g
      and (x.profissional_id = auth.uid() or (x.obra_id is not null and pode_acompanhar_obra(x.obra_id)))
  )
$$;

create or replace function public.condominio_do_membro(m public.membros) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(m.condominio_id, condominio_da_unidade(m.unidade_id), condominio_da_obra(m.obra_id))
$$;

revoke all on function public.condominio_do_membro(public.membros) from anon;

-- ---------------------------------------------------------------- RLS
alter table public.plataforma_admins enable row level security;
alter table public.condominios enable row level security;
alter table public.unidades enable row level security;
alter table public.membros enable row level security;

drop policy if exists "plataforma_admin_self" on public.plataforma_admins;
create policy "plataforma_admin_self" on public.plataforma_admins for select to authenticated
using (email = public.meu_email());

drop policy if exists "condominios_select" on public.condominios;
drop policy if exists "condominios_insert" on public.condominios;
drop policy if exists "condominios_update" on public.condominios;
drop policy if exists "condominios_delete" on public.condominios;
create policy "condominios_select" on public.condominios for select to authenticated using (public.participa_condominio(id));
create policy "condominios_insert" on public.condominios for insert to authenticated with check (public.eh_plataforma_admin());
create policy "condominios_update" on public.condominios for update to authenticated using (public.eh_admin_condominio(id)) with check (public.eh_admin_condominio(id));
create policy "condominios_delete" on public.condominios for delete to authenticated using (public.eh_plataforma_admin());

drop policy if exists "unidades_select" on public.unidades;
drop policy if exists "unidades_write" on public.unidades;
create policy "unidades_select" on public.unidades for select to authenticated using (public.participa_unidade(id));
create policy "unidades_write" on public.unidades for all to authenticated
using (public.eh_admin_condominio(condominio_id)) with check (public.eh_admin_condominio(condominio_id));

drop policy if exists "obras_select" on public.obras;
drop policy if exists "obras_write" on public.obras;
create policy "obras_select" on public.obras for select to authenticated using (public.pode_ver_obra(id));
create policy "obras_write" on public.obras for all to authenticated
using (public.eh_admin_condominio(public.condominio_da_unidade(unidade_id)))
with check (public.eh_admin_condominio(public.condominio_da_unidade(unidade_id)));

drop policy if exists "membros_select" on public.membros;
drop policy if exists "membros_insert" on public.membros;
drop policy if exists "membros_delete" on public.membros;
create policy "membros_select" on public.membros for select to authenticated using (
  email = public.meu_email()
  or public.eh_admin_condominio(public.condominio_do_membro(membros))
  or (papel = 'profissional' and public.pode_acompanhar_obra(obra_id))
);
create policy "membros_insert" on public.membros for insert to authenticated
with check (public.eh_admin_condominio(public.condominio_do_membro(membros)));
create policy "membros_delete" on public.membros for delete to authenticated
using (public.eh_admin_condominio(public.condominio_do_membro(membros)));

-- gravacoes: substitui as políticas provisórias da versão inicial.
drop policy if exists "worker_select_own_recordings" on public.gravacoes;
drop policy if exists "worker_insert_own_recordings" on public.gravacoes;
drop policy if exists "worker_update_own_recordings" on public.gravacoes;
drop policy if exists "gravacoes_select" on public.gravacoes;
drop policy if exists "gravacoes_insert" on public.gravacoes;
drop policy if exists "gravacoes_update" on public.gravacoes;
create policy "gravacoes_select" on public.gravacoes for select to authenticated using (
  profissional_id = auth.uid() or (obra_id is not null and public.pode_acompanhar_obra(obra_id))
);
-- Só grava quem está vinculado a uma obra ativa.
create policy "gravacoes_insert" on public.gravacoes for insert to authenticated with check (
  profissional_id = auth.uid()
  and obra_id is not null
  and public.eh_profissional_obra(obra_id)
  and exists (select 1 from public.obras ob where ob.id = obra_id and ob.status = 'ativa')
);
create policy "gravacoes_update" on public.gravacoes for update to authenticated
using (profissional_id = auth.uid())
with check (profissional_id = auth.uid() and (obra_id is null or public.eh_profissional_obra(obra_id)));

drop policy if exists "worker_select_own_segments" on public.arquivos_video;
drop policy if exists "arquivos_select" on public.arquivos_video;
create policy "arquivos_select" on public.arquivos_video for select to authenticated
using (public.pode_ver_gravacao(gravacao_id::text));
-- (a política de inserção "worker_insert_own_segments" continua valendo)

drop policy if exists "worker_read_own_video" on storage.objects;
drop policy if exists "obras_videos_select" on storage.objects;
create policy "obras_videos_select" on storage.objects for select to authenticated using (
  bucket_id = 'obras-videos' and public.pode_ver_gravacao((storage.foldername(name))[1])
);
-- (a política de upload "worker_upload_own_video" continua valendo)
