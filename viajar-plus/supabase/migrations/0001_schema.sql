-- VIAJAR+ — esquema principal
-- As colunas espelham src/lib/types.ts (snake_case). "users" é a tabela auth.users do Supabase.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Perfis (1:1 com auth.users)
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  locale text not null default 'pt-BR',
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  consent_location boolean not null default false,
  consent_share_media boolean not null default false,
  accepted_terms_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, accepted_terms_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    case when (new.raw_user_meta_data ->> 'accepted_terms') = 'true' then now() else null end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Viagens e participantes
-- ---------------------------------------------------------------------------

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  destination text not null default '',
  destination_country text not null default '',
  destination_lat double precision,
  destination_lng double precision,
  origin text not null default '',
  start_date date not null,
  end_date date not null,
  adults integer not null default 1 check (adults between 0 and 50),
  children integer not null default 0 check (children between 0 and 50),
  children_ages integer[] not null default '{}',
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  budget_total numeric(14, 2) not null default 0 check (budget_total >= 0),
  budget_per_person numeric(14, 2) not null default 0 check (budget_per_person >= 0),
  transport_prefs text[] not null default '{}',
  lodging_prefs text[] not null default '{}',
  activity_prefs text[] not null default '{}',
  pace text not null default 'moderado' check (pace in ('tranquilo', 'moderado', 'intenso')),
  accessibility text not null default '',
  restrictions text not null default '',
  notes text not null default '',
  desired_experiences text not null default '',
  status text not null default 'planejando' check (status in ('planejando', 'reservada', 'em_andamento', 'concluida')),
  cover_media_id uuid,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_dates_ok check (end_date >= start_date)
);
create index if not exists trips_owner_idx on public.trips (owner_id);

create table if not exists public.trip_members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  name text not null default '',
  email text not null default '',
  role text not null default 'leitor' check (role in ('proprietario', 'editor', 'financeiro', 'colaborador', 'leitor')),
  permissions jsonb not null default '{"edit_trip":false,"budget":false,"reservations":false,"diary":false,"media":false}',
  invite_status text not null default 'convidado' check (invite_status in ('convidado', 'aceito', 'recusado')),
  invite_token text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trip_members_trip_idx on public.trip_members (trip_id);
create index if not exists trip_members_user_idx on public.trip_members (user_id);
create unique index if not exists trip_members_trip_user_uq on public.trip_members (trip_id, user_id) where user_id is not null;

create table if not exists public.destinations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null,
  country text not null default '',
  lat double precision,
  lng double precision,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists destinations_trip_idx on public.destinations (trip_id);

create table if not exists public.travelers (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null,
  kind text not null default 'adulto' check (kind in ('adulto', 'crianca')),
  age integer check (age between 0 and 130),
  member_id uuid references public.trip_members (id) on delete set null,
  responsibilities text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists travelers_trip_idx on public.travelers (trip_id);
create index if not exists travelers_member_idx on public.travelers (member_id);

-- ---------------------------------------------------------------------------
-- Pesquisa, fornecedores e cotações
-- ---------------------------------------------------------------------------

create table if not exists public.providers (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  type text not null check (type in ('voo', 'hospedagem', 'carro', 'passeio', 'outro', 'dados')),
  website text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.search_queries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  type text not null check (type in ('voo', 'hospedagem', 'carro', 'passeio', 'outro', 'lugares')),
  provider text not null default '',
  params jsonb not null default '{}',
  results_count integer not null default 0,
  status text not null default 'ok' check (status in ('ok', 'erro', 'indisponivel')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists search_queries_trip_idx on public.search_queries (trip_id);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  type text not null check (type in ('voo', 'hospedagem', 'carro', 'passeio', 'outro')),
  title text not null,
  provider_name text not null default '',
  source text not null default 'manual' check (source in ('api', 'manual', 'demo')),
  url text not null default '' check (url = '' or url ~* '^https?://'),
  total_price numeric(14, 2) not null check (total_price >= 0),
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  fx_rate numeric(18, 8) not null default 1 check (fx_rate > 0),
  travelers_count integer not null default 1 check (travelers_count >= 1),
  units integer not null default 1 check (units >= 1),
  captured_at timestamptz not null default now(),
  valid_until timestamptz,
  search_key text not null default '',
  details jsonb not null default '{}',
  status text not null default 'ativa' check (status in ('ativa', 'descartada', 'convertida')),
  expense_id uuid,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quotes_trip_idx on public.quotes (trip_id);
create index if not exists quotes_search_key_idx on public.quotes (trip_id, search_key);
create index if not exists quotes_expense_idx on public.quotes (expense_id);

-- Opções normalizadas retornadas pelos provedores e salvas pelo usuário (instantâneo da consulta).
create table if not exists public.flight_options (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  quote_id uuid references public.quotes (id) on delete cascade,
  provider text not null,
  payload jsonb not null,
  queried_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists flight_options_trip_idx on public.flight_options (trip_id);
create index if not exists flight_options_quote_idx on public.flight_options (quote_id);

create table if not exists public.lodging_options (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  quote_id uuid references public.quotes (id) on delete cascade,
  provider text not null,
  payload jsonb not null,
  queried_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lodging_options_trip_idx on public.lodging_options (trip_id);
create index if not exists lodging_options_quote_idx on public.lodging_options (quote_id);

create table if not exists public.rental_options (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  quote_id uuid references public.quotes (id) on delete cascade,
  provider text not null,
  payload jsonb not null,
  queried_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists rental_options_trip_idx on public.rental_options (trip_id);
create index if not exists rental_options_quote_idx on public.rental_options (quote_id);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null,
  category text not null default 'outro' check (category in (
    'atracao', 'parque', 'barco', 'museu', 'trilha', 'guia', 'familia', 'restaurante', 'bar', 'cafe',
    'culinaria', 'religioso', 'mirante', 'outro')),
  description text not null default '',
  price_per_person numeric(14, 2) check (price_per_person >= 0),
  price_group numeric(14, 2) check (price_group >= 0),
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  duration_min integer check (duration_min >= 0),
  min_age integer check (min_age >= 0),
  accessibility text not null default '',
  meeting_point text not null default '',
  cancellation_policy text not null default '',
  provider_name text not null default '',
  url text not null default '' check (url = '' or url ~* '^https?://'),
  lat double precision,
  lng double precision,
  opening_hours text not null default '',
  free_entry boolean,
  instagrammable boolean not null default false,
  source text not null default 'manual' check (source in ('api', 'manual', 'demo', 'osm')),
  source_ref text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists activities_trip_idx on public.activities (trip_id);

-- ---------------------------------------------------------------------------
-- Orçamento
-- ---------------------------------------------------------------------------

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null unique references public.trips (id) on delete cascade,
  total numeric(14, 2) not null default 0 check (total >= 0),
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  alert_thresholds numeric[] not null default '{70,90,100}',
  days_considered integer check (days_considered > 0),
  per_traveler_basis text not null default 'projecao' check (per_traveler_basis in ('projecao', 'realizado', 'previsto')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  key text not null,
  name text not null,
  color text not null default '#94a3b8',
  is_custom boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, key)
);
create index if not exists budget_categories_trip_idx on public.budget_categories (trip_id);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  category_key text not null,
  description text not null,
  supplier text not null default '',
  quantity numeric(14, 3) not null default 1 check (quantity >= 0),
  unit_price numeric(14, 2) not null default 0 check (unit_price >= 0),
  original_currency text not null default 'BRL' check (original_currency ~ '^[A-Z]{3}$'),
  fx_rate numeric(18, 8) not null default 1 check (fx_rate > 0),
  fees numeric(14, 2) not null default 0 check (fees >= 0),
  planned_amount numeric(14, 2) not null default 0 check (planned_amount >= 0),
  quoted_amount numeric(14, 2) not null default 0 check (quoted_amount >= 0),
  reserved_amount numeric(14, 2) not null default 0 check (reserved_amount >= 0),
  due_date date,
  responsible_traveler_id uuid references public.travelers (id) on delete set null,
  status text not null default 'previsto' check (status in ('previsto', 'cotado', 'reservado', 'parcial', 'pago', 'cancelado')),
  receipt_document_id uuid,
  notes text not null default '',
  split_mode text not null default 'todos' check (split_mode in ('todos', 'selecionados', 'personalizado', 'individual')),
  split jsonb not null default '{}',
  quote_id uuid references public.quotes (id) on delete set null,
  reservation_id uuid,
  diary_entry_id uuid,
  incurred_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists expenses_trip_idx on public.expenses (trip_id);
create index if not exists expenses_category_idx on public.expenses (trip_id, category_key);
create index if not exists expenses_due_idx on public.expenses (due_date) where due_date is not null;
create index if not exists expenses_responsible_idx on public.expenses (responsible_traveler_id);
create index if not exists expenses_quote_idx on public.expenses (quote_id);
create index if not exists expenses_reservation_idx on public.expenses (reservation_id);
create index if not exists expenses_diary_idx on public.expenses (diary_entry_id);
create index if not exists expenses_receipt_idx on public.expenses (receipt_document_id);

alter table public.quotes
  drop constraint if exists quotes_expense_fk,
  add constraint quotes_expense_fk foreign key (expense_id) references public.expenses (id) on delete set null;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  expense_id uuid not null references public.expenses (id) on delete cascade,
  kind text not null default 'pagamento' check (kind in ('pagamento', 'estorno')),
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  fx_rate numeric(18, 8) not null default 1 check (fx_rate > 0),
  paid_at date not null default current_date,
  payer_traveler_id uuid references public.travelers (id) on delete set null,
  -- apenas o meio de pagamento; nunca números de cartão, CVV ou senhas
  method text not null default 'outro' check (method in ('pix', 'cartao', 'dinheiro', 'transferencia', 'boleto', 'outro')),
  notes text not null default '',
  receipt_document_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payments_trip_idx on public.payments (trip_id);
create index if not exists payments_expense_idx on public.payments (expense_id);
create index if not exists payments_payer_idx on public.payments (payer_traveler_id);
create index if not exists payments_receipt_idx on public.payments (receipt_document_id);

-- ---------------------------------------------------------------------------
-- Reservas e documentos
-- ---------------------------------------------------------------------------

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  type text not null check (type in ('voo', 'hospedagem', 'carro', 'passeio', 'outro')),
  title text not null,
  provider_name text not null default '',
  confirmation_code text not null default '',
  start_at timestamptz,
  end_at timestamptz,
  cancellation_policy text not null default '',
  cancel_deadline timestamptz,
  amount numeric(14, 2) not null default 0 check (amount >= 0),
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pendente' check (status in ('pendente', 'confirmada', 'cancelada', 'concluida')),
  url text not null default '' check (url = '' or url ~* '^https?://'),
  expense_id uuid references public.expenses (id) on delete set null,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reservations_trip_idx on public.reservations (trip_id);
create index if not exists reservations_expense_idx on public.reservations (expense_id);
create index if not exists reservations_start_idx on public.reservations (start_at);

alter table public.expenses
  drop constraint if exists expenses_reservation_fk,
  add constraint expenses_reservation_fk foreign key (reservation_id) references public.reservations (id) on delete set null;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  reservation_id uuid references public.reservations (id) on delete set null,
  expense_id uuid references public.expenses (id) on delete set null,
  kind text not null default 'outro' check (kind in ('voucher', 'comprovante', 'bilhete', 'seguro', 'documento', 'outro')),
  title text not null default '',
  storage_path text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists documents_trip_idx on public.documents (trip_id);
create index if not exists documents_reservation_idx on public.documents (reservation_id);
create index if not exists documents_expense_idx on public.documents (expense_id);

alter table public.expenses
  drop constraint if exists expenses_receipt_fk,
  add constraint expenses_receipt_fk foreign key (receipt_document_id) references public.documents (id) on delete set null;
alter table public.payments
  drop constraint if exists payments_receipt_fk,
  add constraint payments_receipt_fk foreign key (receipt_document_id) references public.documents (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Roteiro
-- ---------------------------------------------------------------------------

create table if not exists public.itinerary_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  date date not null,
  title text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, date)
);
create index if not exists itinerary_days_trip_idx on public.itinerary_days (trip_id);

create table if not exists public.itinerary_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  day_id uuid not null references public.itinerary_days (id) on delete cascade,
  title text not null,
  kind text not null default 'outro' check (kind in ('passeio', 'refeicao', 'deslocamento', 'hospedagem', 'voo', 'descanso', 'outro')),
  start_time text check (start_time is null or start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  duration_min integer not null default 60 check (duration_min >= 0),
  address text not null default '',
  lat double precision,
  lng double precision,
  cost_estimate numeric(14, 2) not null default 0 check (cost_estimate >= 0),
  currency text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  travel_min_from_prev integer check (travel_min_from_prev >= 0),
  opening_hours text not null default '',
  notes text not null default '',
  booking_status text not null default 'planejado' check (booking_status in ('sugestao', 'planejado', 'reservado', 'concluido')),
  reservation_id uuid references public.reservations (id) on delete set null,
  activity_id uuid references public.activities (id) on delete set null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- uma atividade só pode constar como "reservada" com uma reserva vinculada
  constraint itinerary_reserved_needs_reservation check (booking_status <> 'reservado' or reservation_id is not null)
);
create index if not exists itinerary_items_trip_idx on public.itinerary_items (trip_id);
create index if not exists itinerary_items_day_idx on public.itinerary_items (day_id, position);
create index if not exists itinerary_items_reservation_idx on public.itinerary_items (reservation_id);
create index if not exists itinerary_items_activity_idx on public.itinerary_items (activity_id);

-- ---------------------------------------------------------------------------
-- Diário, mídia, álbuns e vídeo
-- ---------------------------------------------------------------------------

create table if not exists public.diary_entries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  date date not null,
  title text not null,
  body text not null default '',
  location_name text not null default '',
  lat double precision,
  lng double precision,
  author_traveler_id uuid references public.travelers (id) on delete set null,
  rating integer check (rating between 1 and 5),
  mood text not null default '',
  tags text[] not null default '{}',
  people text[] not null default '{}',
  instagrammable boolean not null default false,
  story_answers jsonb not null default '[]',
  is_draft boolean not null default false,
  base_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists diary_entries_trip_idx on public.diary_entries (trip_id, date);
create index if not exists diary_entries_author_idx on public.diary_entries (author_traveler_id);

alter table public.expenses
  drop constraint if exists expenses_diary_fk,
  add constraint expenses_diary_fk foreign key (diary_entry_id) references public.diary_entries (id) on delete set null;

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  kind text not null check (kind in ('image', 'video', 'audio')),
  storage_path text not null,
  thumb_path text,
  original_name text not null default '',
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  width integer,
  height integer,
  duration_sec double precision,
  taken_at timestamptz,
  lat double precision,
  lng double precision,
  caption text not null default '',
  tags text[] not null default '{}',
  people text[] not null default '{}',
  album text not null default '',
  favorite boolean not null default false,
  instagrammable boolean not null default false,
  diary_entry_id uuid references public.diary_entries (id) on delete set null,
  story_answers jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists media_assets_trip_idx on public.media_assets (trip_id, taken_at);
create index if not exists media_assets_diary_idx on public.media_assets (diary_entry_id);

alter table public.trips
  drop constraint if exists trips_cover_media_fk,
  add constraint trips_cover_media_fk foreign key (cover_media_id) references public.media_assets (id) on delete set null;
create index if not exists trips_cover_media_idx on public.trips (cover_media_id);

create table if not exists public.photo_edits (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  media_id uuid not null references public.media_assets (id) on delete cascade,
  name text not null default '',
  operations jsonb not null default '{}',
  output_path text not null,
  output_mime text not null,
  width integer not null,
  height integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists photo_edits_trip_idx on public.photo_edits (trip_id);
create index if not exists photo_edits_media_idx on public.photo_edits (media_id);

create table if not exists public.albums (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  title text not null,
  subtitle text not null default '',
  format text not null default 'A4' check (format in ('A4', 'quadrado', 'vertical', 'horizontal')),
  margin_mm numeric(6, 2) not null default 12 check (margin_mm >= 0),
  gap_mm numeric(6, 2) not null default 4 check (gap_mm >= 0),
  background text not null default '#ffffff',
  frame text not null default 'nenhuma',
  include_cover boolean not null default true,
  include_toc boolean not null default true,
  include_itinerary boolean not null default true,
  include_budget boolean not null default false,
  include_diary boolean not null default true,
  footer_text text not null default '',
  page_numbers boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists albums_trip_idx on public.albums (trip_id);

create table if not exists public.album_pages (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.albums (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  position integer not null default 0,
  layout text not null default '1' check (layout in ('1', '2', '3', '4', 'colagem', 'texto')),
  title text not null default '',
  text text not null default '',
  date_label text not null default '',
  background text not null default '',
  frame text not null default '',
  items jsonb not null default '[]',
  included boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists album_pages_album_idx on public.album_pages (album_id, position);
create index if not exists album_pages_trip_idx on public.album_pages (trip_id);

create table if not exists public.video_projects (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  title text not null,
  aspect text not null default '9:16' check (aspect in ('9:16', '1:1', '16:9')),
  clips jsonb not null default '[]',
  transition text not null default 'fade' check (transition in ('corte', 'fade')),
  audio_media_id uuid references public.media_assets (id) on delete set null,
  audio_volume numeric(4, 3) not null default 0.8 check (audio_volume between 0 and 1),
  resolution integer not null default 720 check (resolution in (480, 720, 1080)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists video_projects_trip_idx on public.video_projects (trip_id);
create index if not exists video_projects_audio_idx on public.video_projects (audio_media_id);

-- ---------------------------------------------------------------------------
-- Notificações
-- ---------------------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  kind text not null default 'sistema' check (kind in ('checkin', 'checkout', 'vencimento', 'horario', 'orcamento', 'convite', 'sistema')),
  title text not null,
  body text not null default '',
  due_at timestamptz,
  read_at timestamptz,
  ref text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notifications_trip_idx on public.notifications (trip_id);
create index if not exists notifications_user_idx on public.notifications (user_id, read_at);

-- ---------------------------------------------------------------------------
-- updated_at automático em todas as tabelas
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
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- Fornecedores/fontes de referência (somente leitura para usuários).
insert into public.providers (key, name, type, website, notes) values
  ('amadeus', 'Amadeus for Developers', 'voo', 'https://developers.amadeus.com', 'Voos, hotéis e atividades (requer credenciais).'),
  ('duffel', 'Duffel', 'voo', 'https://duffel.com', 'Voos (requer token de acesso).'),
  ('osm', 'OpenStreetMap (Overpass/Nominatim)', 'dados', 'https://www.openstreetmap.org/copyright', 'Lugares e geocodificação. © colaboradores do OpenStreetMap, ODbL.'),
  ('open-meteo', 'Open-Meteo', 'dados', 'https://open-meteo.com', 'Previsão do tempo (CC BY 4.0).'),
  ('exchangerate-api', 'ExchangeRate-API (open access)', 'dados', 'https://www.exchangerate-api.com', 'Câmbio de referência, com atribuição.'),
  ('frankfurter', 'Frankfurter (BCE)', 'dados', 'https://frankfurter.dev', 'Câmbio de referência do Banco Central Europeu.')
on conflict (key) do nothing;
