-- VIAJAR+ — Row Level Security
-- Cada usuário só acessa viagens das quais é dono ou membro aceito.
-- Escrita exige a permissão correspondente (edit_trip, budget, reservations, diary, media).

-- ---------------------------------------------------------------------------
-- Funções de autorização (security definer evita recursão de RLS)
-- ---------------------------------------------------------------------------

create or replace function public.safe_uuid(p text)
returns uuid
language plpgsql
immutable
as $$
begin
  return p::uuid;
exception when others then
  return null;
end;
$$;

create or replace function public.is_trip_owner(p_trip uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.trips t where t.id = p_trip and t.owner_id = auth.uid());
$$;

create or replace function public.is_trip_member(p_trip uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_trip_owner(p_trip)
    or exists (
      select 1 from public.trip_members m
      where m.trip_id = p_trip and m.user_id = auth.uid() and m.invite_status = 'aceito'
    );
$$;

-- perm: 'edit_trip' | 'budget' | 'reservations' | 'diary' | 'media'
create or replace function public.has_trip_permission(p_trip uuid, p_perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_trip_owner(p_trip)
    or exists (
      select 1 from public.trip_members m
      where m.trip_id = p_trip
        and m.user_id = auth.uid()
        and m.invite_status = 'aceito'
        and (m.role in ('proprietario', 'editor') or coalesce((m.permissions ->> p_perm)::boolean, false))
    );
$$;

revoke all on function public.is_trip_owner(uuid) from public;
revoke all on function public.is_trip_member(uuid) from public;
revoke all on function public.has_trip_permission(uuid, text) from public;
grant execute on function public.is_trip_owner(uuid) to authenticated;
grant execute on function public.is_trip_member(uuid) to authenticated;
grant execute on function public.has_trip_permission(uuid, text) to authenticated;
grant execute on function public.safe_uuid(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Habilita RLS em todas as tabelas
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'trips', 'trip_members', 'destinations', 'travelers', 'providers', 'search_queries', 'quotes',
    'flight_options', 'lodging_options', 'rental_options', 'activities', 'budgets', 'budget_categories',
    'expenses', 'payments', 'reservations', 'documents', 'itinerary_days', 'itinerary_items', 'diary_entries',
    'media_assets', 'photo_edits', 'albums', 'album_pages', 'video_projects', 'notifications'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Perfis: cada um vê e altera apenas o próprio
-- ---------------------------------------------------------------------------

drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists profiles_self_insert on public.profiles;
create policy profiles_self_insert on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Fornecedores: leitura para usuários autenticados; escrita só pelo service role
-- ---------------------------------------------------------------------------

drop policy if exists providers_read on public.providers;
create policy providers_read on public.providers for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Viagens
-- ---------------------------------------------------------------------------

drop policy if exists trips_select on public.trips;
create policy trips_select on public.trips for select to authenticated
  using (owner_id = auth.uid() or public.is_trip_member(id));
drop policy if exists trips_insert on public.trips;
create policy trips_insert on public.trips for insert to authenticated
  with check (owner_id = auth.uid());
drop policy if exists trips_update on public.trips;
create policy trips_update on public.trips for update to authenticated
  using (public.has_trip_permission(id, 'edit_trip'))
  with check (public.has_trip_permission(id, 'edit_trip'));
drop policy if exists trips_delete on public.trips;
create policy trips_delete on public.trips for delete to authenticated
  using (owner_id = auth.uid());

-- Impede que um editor transfira a viagem trocando o owner_id.
create or replace function public.trips_keep_owner()
returns trigger
language plpgsql
as $$
begin
  if new.owner_id <> old.owner_id and old.owner_id <> auth.uid() then
    raise exception 'Somente o proprietário pode transferir a viagem';
  end if;
  return new;
end;
$$;
drop trigger if exists trips_keep_owner on public.trips;
create trigger trips_keep_owner before update on public.trips for each row execute function public.trips_keep_owner();

-- ---------------------------------------------------------------------------
-- Participantes: membros veem; o dono gerencia; o próprio membro pode sair
-- ---------------------------------------------------------------------------

drop policy if exists members_select on public.trip_members;
create policy members_select on public.trip_members for select to authenticated
  using (public.is_trip_member(trip_id) or user_id = auth.uid());
drop policy if exists members_insert on public.trip_members;
create policy members_insert on public.trip_members for insert to authenticated
  with check (public.is_trip_owner(trip_id));
drop policy if exists members_update on public.trip_members;
create policy members_update on public.trip_members for update to authenticated
  using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));
drop policy if exists members_delete on public.trip_members;
create policy members_delete on public.trip_members for delete to authenticated
  using (public.is_trip_owner(trip_id) or user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Tabelas por viagem: leitura para membros, escrita conforme permissão
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('destinations', 'edit_trip'),
      ('travelers', 'edit_trip'),
      ('activities', 'edit_trip'),
      ('itinerary_days', 'edit_trip'),
      ('itinerary_items', 'edit_trip'),
      ('search_queries', 'budget'),
      ('quotes', 'budget'),
      ('flight_options', 'budget'),
      ('lodging_options', 'budget'),
      ('rental_options', 'budget'),
      ('budgets', 'budget'),
      ('budget_categories', 'budget'),
      ('expenses', 'budget'),
      ('payments', 'budget'),
      ('reservations', 'reservations'),
      ('documents', 'reservations'),
      ('diary_entries', 'diary'),
      ('media_assets', 'media'),
      ('photo_edits', 'media'),
      ('albums', 'media'),
      ('album_pages', 'media'),
      ('video_projects', 'media')
    ) as v(tbl, perm)
  loop
    execute format('drop policy if exists %I on public.%I', r.tbl || '_select', r.tbl);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_trip_member(trip_id))', r.tbl || '_select', r.tbl);
    execute format('drop policy if exists %I on public.%I', r.tbl || '_insert', r.tbl);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.has_trip_permission(trip_id, %L))', r.tbl || '_insert', r.tbl, r.perm);
    execute format('drop policy if exists %I on public.%I', r.tbl || '_update', r.tbl);
    execute format('create policy %I on public.%I for update to authenticated using (public.has_trip_permission(trip_id, %L)) with check (public.has_trip_permission(trip_id, %L))', r.tbl || '_update', r.tbl, r.perm, r.perm);
    execute format('drop policy if exists %I on public.%I', r.tbl || '_delete', r.tbl);
    execute format('create policy %I on public.%I for delete to authenticated using (public.has_trip_permission(trip_id, %L))', r.tbl || '_delete', r.tbl, r.perm);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Notificações: membros da viagem; avisos pessoais só para o destinatário
-- ---------------------------------------------------------------------------

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (public.is_trip_member(trip_id) and (user_id is null or user_id = auth.uid()));
drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert to authenticated
  with check (public.is_trip_member(trip_id) and (user_id is null or user_id = auth.uid()));
drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using (public.is_trip_member(trip_id) and (user_id is null or user_id = auth.uid()))
  with check (public.is_trip_member(trip_id) and (user_id is null or user_id = auth.uid()));
drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications for delete to authenticated
  using (public.is_trip_member(trip_id) and (user_id is null or user_id = auth.uid()));

-- ---------------------------------------------------------------------------
-- Convites: prévia e aceite por token (sem expor a tabela inteira)
-- ---------------------------------------------------------------------------

create or replace function public.trip_invite_preview(p_token text)
returns table (trip_name text, destination text, role text, invite_status text)
language sql
stable
security definer
set search_path = public
as $$
  select t.name, t.destination, m.role, m.invite_status
  from public.trip_members m
  join public.trips t on t.id = m.trip_id
  where m.invite_token = p_token and length(p_token) >= 32;
$$;

create or replace function public.accept_trip_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.trip_members%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Faça login para aceitar o convite';
  end if;
  select * into v_member from public.trip_members where invite_token = p_token and length(p_token) >= 32 for update;
  if not found then
    raise exception 'Convite inválido ou expirado';
  end if;
  if v_member.invite_status = 'aceito' and v_member.user_id is distinct from auth.uid() then
    raise exception 'Convite já utilizado';
  end if;
  if exists (select 1 from public.trip_members where trip_id = v_member.trip_id and user_id = auth.uid() and id <> v_member.id) then
    raise exception 'Você já participa desta viagem';
  end if;
  update public.trip_members
     set user_id = auth.uid(), invite_status = 'aceito', invite_token = null
   where id = v_member.id;
  return v_member.trip_id;
end;
$$;

revoke all on function public.trip_invite_preview(text) from public;
revoke all on function public.accept_trip_invite(text) from public;
grant execute on function public.trip_invite_preview(text) to authenticated;
grant execute on function public.accept_trip_invite(text) to authenticated;
