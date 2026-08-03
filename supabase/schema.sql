-- Rode este script no SQL Editor do seu projeto Supabase
-- (Supabase → SQL Editor → New query → colar e Run).

create table if not exists app_storage (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

-- Habilita Row Level Security e libera leitura/escrita para a chave
-- "anon" (a chave pública usada pelo app no navegador). Como o app não
-- usa o sistema de login do Supabase — ele tem seu próprio login com
-- senha simples por colaborador — não dá para restringir por usuário
-- aqui. Isso é aceitável para uma ferramenta interna, mas significa que
-- qualquer pessoa com a URL e a chave anônima do seu projeto consegue
-- ler e alterar os dados. Não deixe o repositório do projeto público
-- com essas chaves reais, e considere trocar por uma API própria com
-- autenticação se o app crescer além do uso interno.
alter table app_storage enable row level security;

create policy "permite leitura para todos"
  on app_storage for select
  to anon
  using (true);

create policy "permite escrita para todos"
  on app_storage for insert
  to anon
  with check (true);

create policy "permite atualização para todos"
  on app_storage for update
  to anon
  using (true)
  with check (true);

create policy "permite exclusão para todos"
  on app_storage for delete
  to anon
  using (true);
