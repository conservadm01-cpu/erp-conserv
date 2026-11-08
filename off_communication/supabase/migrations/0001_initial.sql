-- Supabase is optional control-plane only. Local PTT must never depend on it.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  created_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  owner_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  is_private boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.channel_members (
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create table if not exists public.device_registrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  device_public_key text,
  platform text not null check (platform in ('android','ios','other')),
  label text,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.channels enable row level security;
alter table public.channel_members enable row level security;
alter table public.device_registrations enable row level security;

create policy "profile self read" on public.profiles for select using (auth.uid() = id);
create policy "profile self insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profile self update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "members read organizations" on public.organizations for select
  using (owner_id = auth.uid()
    or exists (select 1 from public.organization_members m
               where m.organization_id = organizations.id and m.user_id = auth.uid()));
create policy "owner creates organization" on public.organizations for insert with check (owner_id = auth.uid());
create policy "members read membership" on public.organization_members for select using (user_id = auth.uid());
create policy "members read channels" on public.channels for select
  using (organization_id is null or exists (select 1 from public.organization_members m where m.organization_id = channels.organization_id and m.user_id = auth.uid()));
create policy "users read own channel memberships" on public.channel_members for select using (user_id = auth.uid());
create policy "users manage own devices" on public.device_registrations for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- O dono vira membro 'owner' automaticamente. Sem isso, como não há política
-- de INSERT em organization_members, ninguém conseguiria entrar na própria
-- organização pelo app.
create or replace function public.add_owner_as_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.organization_members (organization_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

create trigger organizations_add_owner
  after insert on public.organizations
  for each row execute function public.add_owner_as_member();
