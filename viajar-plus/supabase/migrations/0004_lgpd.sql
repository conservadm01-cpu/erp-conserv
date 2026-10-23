-- VIAJAR+ — apoio à LGPD (exportação e exclusão de dados do titular)

-- Lista os caminhos de arquivos das viagens de que o usuário é dono,
-- para que a API remova os objetos do storage antes de excluir a conta.
create or replace function public.my_owned_storage_paths()
returns table (bucket text, path text)
language sql
stable
security definer
set search_path = public
as $$
  select 'media', m.storage_path from public.media_assets m join public.trips t on t.id = m.trip_id where t.owner_id = auth.uid()
  union all
  select 'media', m.thumb_path from public.media_assets m join public.trips t on t.id = m.trip_id where t.owner_id = auth.uid() and m.thumb_path is not null
  union all
  select 'media', e.output_path from public.photo_edits e join public.trips t on t.id = e.trip_id where t.owner_id = auth.uid()
  union all
  select 'documents', d.storage_path from public.documents d join public.trips t on t.id = d.trip_id where t.owner_id = auth.uid();
$$;

revoke all on function public.my_owned_storage_paths() from public;
grant execute on function public.my_owned_storage_paths() to authenticated;

-- Ao excluir o usuário (auth.users), as viagens de que ele é dono são removidas
-- em cascata (trips.owner_id on delete cascade); nas viagens de terceiros, o
-- vínculo em trip_members fica sem usuário (on delete set null) e é apagado aqui.
create or replace function public.cleanup_deleted_user_memberships()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.trip_members where user_id is null and invite_status = 'aceito';
  return null;
end;
$$;

drop trigger if exists cleanup_memberships_after_user_delete on auth.users;
create trigger cleanup_memberships_after_user_delete
  after delete on auth.users
  for each statement execute function public.cleanup_deleted_user_memberships();
