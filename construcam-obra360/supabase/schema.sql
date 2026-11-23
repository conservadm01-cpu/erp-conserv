-- Construcam Obra 360: esquema inicial.
-- Antes de produção, complete as tabelas de condomínios, unidades,
-- membros, convites, consentimentos/avisos e permissões por papel.

create table if not exists public.obras (
  id uuid primary key default gen_random_uuid(),
  condominio text not null,
  apartamento text not null,
  empresa text,
  descricao text,
  status text not null default 'ativa',
  created_at timestamptz not null default now()
);

create table if not exists public.gravacoes (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references public.obras(id),
  profissional_id uuid not null references auth.users(id),
  status text not null default 'iniciada',
  inicio timestamptz not null default now(),
  fim timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.arquivos_video (
  id uuid primary key default gen_random_uuid(),
  gravacao_id uuid not null references public.gravacoes(id) on delete cascade,
  caminho_storage text not null unique,
  numero_segmento integer not null,
  tamanho_bytes bigint,
  created_at timestamptz not null default now(),
  unique (gravacao_id, numero_segmento)
);

create table if not exists public.ocorrencias (
  id uuid primary key default gen_random_uuid(),
  gravacao_id uuid not null references public.gravacoes(id),
  descricao text not null,
  inicio_trecho timestamptz,
  fim_trecho timestamptz,
  preservada boolean not null default false,
  solicitado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.obras enable row level security;
alter table public.gravacoes enable row level security;
alter table public.arquivos_video enable row level security;
alter table public.ocorrencias enable row level security;

-- Políticas provisórias para o MVP: profissional só vê/cria suas próprias sessões.
create policy "worker_select_own_recordings"
on public.gravacoes for select to authenticated
using (profissional_id = auth.uid());

create policy "worker_insert_own_recordings"
on public.gravacoes for insert to authenticated
with check (profissional_id = auth.uid());

create policy "worker_update_own_recordings"
on public.gravacoes for update to authenticated
using (profissional_id = auth.uid())
with check (profissional_id = auth.uid());

create policy "worker_select_own_segments"
on public.arquivos_video for select to authenticated
using (exists (
  select 1 from public.gravacoes g
  where g.id = gravacao_id and g.profissional_id = auth.uid()
));

create policy "worker_insert_own_segments"
on public.arquivos_video for insert to authenticated
with check (exists (
  select 1 from public.gravacoes g
  where g.id = gravacao_id and g.profissional_id = auth.uid()
));

-- Bucket privado. Crie-o também no Storage com o nome obras-videos.
insert into storage.buckets (id, name, public, file_size_limit)
values ('obras-videos', 'obras-videos', false, 52428800)
on conflict (id) do nothing;

-- Upload permitido somente para usuário autenticado em pasta cujo primeiro
-- componente seja o ID de uma gravação própria.
create policy "worker_upload_own_video"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'obras-videos'
  and exists (
    select 1 from public.gravacoes g
    where g.id::text = (storage.foldername(name))[1]
      and g.profissional_id = auth.uid()
  )
);

create policy "worker_read_own_video"
on storage.objects for select to authenticated
using (
  bucket_id = 'obras-videos'
  and exists (
    select 1 from public.gravacoes g
    where g.id::text = (storage.foldername(name))[1]
      and g.profissional_id = auth.uid()
  )
);

-- IMPORTANTE:
-- Não habilite políticas públicas para vídeos.
-- As permissões de proprietário, síndico e empresa devem ser implementadas
-- por vínculo explícito com a obra e papéis validados no servidor.
