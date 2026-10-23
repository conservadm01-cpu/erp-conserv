-- VIAJAR+ — dados de demonstração (claramente identificados)
-- Uso (SQL Editor do Supabase, como administrador):
--   select public.seed_demo_trip('<uuid do usuário em auth.users>');
-- Os valores são ESTIMATIVAS FICTÍCIAS de demonstração e NÃO são cotações reais.

create or replace function public.seed_demo_trip(p_user uuid)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_trip uuid;
  v_note constant text := 'Estimativa fictícia de demonstração — não é cotação real.';
  v_day uuid[];
begin
  if not exists (select 1 from auth.users where id = p_user) then
    raise exception 'Usuário % não existe em auth.users', p_user;
  end if;

  insert into public.trips (
    owner_id, name, destination, destination_country, destination_lat, destination_lng, origin,
    start_date, end_date, adults, children, children_ages, currency, budget_total, budget_per_person,
    transport_prefs, lodging_prefs, activity_prefs, pace, restrictions, notes, desired_experiences, status, is_demo
  ) values (
    p_user, 'Patagônia em família — El Calafate (DEMONSTRAÇÃO)', 'El Calafate', 'Argentina', -50.3379, -72.2648,
    'São Paulo — Guarulhos (GRU)', '2026-12-10', '2026-12-15', 4, 1, '{8}', 'BRL', 40000, 8000,
    '{aviao,carro_alugado}', '{apartamento}', '{natureza,glaciares,gastronomia,fotografia,familia}', 'moderado',
    'Criança de 8 anos: verificar idade mínima dos passeios de trekking no gelo.',
    'Dados de demonstração: valores são estimativas fictícias para ilustrar o sistema e NÃO são cotações reais.',
    'Queremos ver o Glaciar Perito Moreno de perto, navegar entre icebergs, provar o cordeiro patagônico e um bom chocolate quente, conhecer uma igreja ou capela local e tirar fotos incríveis no pôr do sol do Lago Argentino. Ritmo tranquilo por causa da criança.',
    'planejando', true
  ) returning id into v_trip;

  insert into public.trip_members (trip_id, user_id, name, role, permissions, invite_status)
  values (v_trip, p_user, 'Você', 'proprietario',
          '{"edit_trip":true,"budget":true,"reservations":true,"diary":true,"media":true}', 'aceito');

  insert into public.budgets (trip_id, total, currency) values (v_trip, 40000, 'BRL');

  insert into public.budget_categories (trip_id, key, name, color, position) values
    (v_trip, 'passagens', 'Passagens', '#2563eb', 0),
    (v_trip, 'bagagem_aeroporto', 'Bagagem e transporte até o aeroporto', '#0891b2', 1),
    (v_trip, 'hospedagem', 'Hospedagem', '#7c3aed', 2),
    (v_trip, 'carro', 'Carro, combustível, estacionamento e pedágios', '#ea580c', 3),
    (v_trip, 'transporte', 'Transporte público e transfer', '#0d9488', 4),
    (v_trip, 'passeios', 'Passeios, ingressos e guias', '#16a34a', 5),
    (v_trip, 'alimentacao', 'Alimentação', '#dc2626', 6),
    (v_trip, 'seguro', 'Seguro viagem', '#4f46e5', 7),
    (v_trip, 'documentacao', 'Documentação e taxas', '#64748b', 8),
    (v_trip, 'compras', 'Compras', '#db2777', 9),
    (v_trip, 'internet', 'Internet e telefonia', '#0284c7', 10),
    (v_trip, 'emergencias', 'Emergências e imprevistos', '#b91c1c', 11),
    (v_trip, 'outros', 'Outras despesas', '#a16207', 12);

  insert into public.travelers (trip_id, name, kind, age) values
    (v_trip, 'Ana', 'adulto', null),
    (v_trip, 'Bruno', 'adulto', null),
    (v_trip, 'Carla', 'adulto', null),
    (v_trip, 'Diego', 'adulto', null),
    (v_trip, 'Lia', 'crianca', 8);

  insert into public.itinerary_days (trip_id, date, title)
  select v_trip, d::date, 'Dia ' || (row_number() over (order by d))::text
  from generate_series('2026-12-10'::date, '2026-12-15'::date, interval '1 day') as d;

  select array_agg(id order by date) into v_day from public.itinerary_days where trip_id = v_trip;

  insert into public.expenses (trip_id, category_key, description, planned_amount, notes) values
    (v_trip, 'passagens', 'Voos GRU ⇄ FTE (5 passageiros)', 17500, v_note),
    (v_trip, 'bagagem_aeroporto', 'Transporte até Guarulhos e bagagem despachada', 900, v_note),
    (v_trip, 'hospedagem', 'Apartamento tipo Airbnb — 5 noites', 6000, v_note),
    (v_trip, 'carro', 'Carro alugado SUV 7 lugares — 5 diárias', 3500, v_note),
    (v_trip, 'carro', 'Combustível e estacionamento', 900, v_note),
    (v_trip, 'passeios', 'Passarelas do Perito Moreno — ingressos do parque', 1500, v_note),
    (v_trip, 'passeios', 'Navegação pelos glaciares', 3000, v_note),
    (v_trip, 'alimentacao', 'Refeições e mercado', 4000, v_note),
    (v_trip, 'seguro', 'Seguro viagem para 5 pessoas', 600, v_note),
    (v_trip, 'internet', 'Chip/eSIM de dados', 200, v_note),
    (v_trip, 'emergencias', 'Reserva para imprevistos', 1500, v_note);

  insert into public.itinerary_items (trip_id, day_id, title, kind, start_time, duration_min, address, notes, booking_status, position) values
    (v_trip, v_day[1], 'Chegada a El Calafate e retirada do carro', 'deslocamento', '15:00', 90, 'Aeroporto Internacional de El Calafate (FTE)', 'Sugestão de demonstração — confirmar horários e disponibilidade com o fornecedor.', 'sugestao', 0),
    (v_trip, v_day[1], 'Reserva Natural Laguna Nimez (observação de aves)', 'passeio', '17:30', 90, 'Laguna Nimez, El Calafate', 'Sugestão de demonstração — confirmar horários e disponibilidade com o fornecedor.', 'sugestao', 1),
    (v_trip, v_day[2], 'Glaciar Perito Moreno — passarelas', 'passeio', '09:00', 300, 'Parque Nacional Los Glaciares', 'Sugestão de demonstração — confirmar horários e disponibilidade com o fornecedor.', 'sugestao', 2),
    (v_trip, v_day[3], 'Navegação pelos glaciares (verificar idade mínima)', 'passeio', '08:30', 420, 'Puerto Punta Bandera', 'Sugestão de demonstração — confirmar horários e disponibilidade com o fornecedor.', 'sugestao', 3),
    (v_trip, v_day[4], 'Bate-volta a El Chaltén (≈ 3h de estrada por trecho)', 'passeio', '07:00', 600, 'El Chaltén', 'Sugestão de demonstração — confirmar horários e disponibilidade com o fornecedor.', 'sugestao', 4),
    (v_trip, v_day[5], 'Glaciarium — museu do gelo', 'passeio', '10:30', 120, 'Glaciarium, El Calafate', 'Sugestão de demonstração — confirmar horários e disponibilidade com o fornecedor.', 'sugestao', 5),
    (v_trip, v_day[5], 'Pôr do sol no Lago Argentino (fotos)', 'passeio', '20:30', 60, 'Costanera, El Calafate', 'Sugestão de demonstração — confirmar horários e disponibilidade com o fornecedor.', 'sugestao', 6),
    (v_trip, v_day[6], 'Devolução do carro e voo de volta', 'voo', '11:00', 120, 'Aeroporto Internacional de El Calafate (FTE)', 'Sugestão de demonstração — confirmar horários e disponibilidade com o fornecedor.', 'sugestao', 7);

  return v_trip;
end;
$$;

-- Somente administradores executam o seed (evita criar viagens para outros usuários).
revoke all on function public.seed_demo_trip(uuid) from public;
