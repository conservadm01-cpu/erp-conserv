-- VIAJAR+ — armazenamento privado de mídia e documentos
-- Caminho dos objetos: <trip_id>/<uuid>.<ext>. A primeira pasta define a viagem
-- e, portanto, quem pode ler (membros) e escrever (permissão media/reservations).
-- O acesso do navegador é feito por URLs assinadas com expiração.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', false, 1073741824, array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/avif',
    'video/mp4', 'video/quicktime', 'video/webm',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg'
  ]),
  ('documents', 'documents', false, 20971520, array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'
  ])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.storage_trip_id(p_name text)
returns uuid
language sql
immutable
as $$
  select public.safe_uuid(split_part(p_name, '/', 1));
$$;

drop policy if exists viajar_media_select on storage.objects;
create policy viajar_media_select on storage.objects for select to authenticated
  using (bucket_id in ('media', 'documents') and public.is_trip_member(public.storage_trip_id(name)));

drop policy if exists viajar_media_insert on storage.objects;
create policy viajar_media_insert on storage.objects for insert to authenticated
  with check (
    (bucket_id = 'media' and public.has_trip_permission(public.storage_trip_id(name), 'media'))
    or (bucket_id = 'documents' and public.has_trip_permission(public.storage_trip_id(name), 'reservations'))
  );

drop policy if exists viajar_media_update on storage.objects;
create policy viajar_media_update on storage.objects for update to authenticated
  using (
    (bucket_id = 'media' and public.has_trip_permission(public.storage_trip_id(name), 'media'))
    or (bucket_id = 'documents' and public.has_trip_permission(public.storage_trip_id(name), 'reservations'))
  );

drop policy if exists viajar_media_delete on storage.objects;
create policy viajar_media_delete on storage.objects for delete to authenticated
  using (
    (bucket_id = 'media' and public.has_trip_permission(public.storage_trip_id(name), 'media'))
    or (bucket_id = 'documents' and public.has_trip_permission(public.storage_trip_id(name), 'reservations'))
  );
