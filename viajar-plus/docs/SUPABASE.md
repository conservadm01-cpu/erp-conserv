# Configurar o Supabase e publicar o VIAJAR+

Sem Supabase o app funciona em **modo demonstração local** (dados só no navegador).
Com Supabase você ganha login, sincronização entre aparelhos, convites para
familiares, mídia na nuvem e exportação/exclusão de dados (LGPD) no servidor.

## 1. Criar o projeto

1. Crie um projeto em <https://supabase.com> (região mais próxima: São Paulo).
2. Em **Project Settings → API** copie:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (secreta; só no servidor)

## 2. Criar o banco (migrations)

No **SQL Editor**, execute os arquivos **nesta ordem**, um por vez:

1. `supabase/migrations/0001_schema.sql` — tabelas, índices, chaves estrangeiras e gatilhos
2. `supabase/migrations/0002_rls.sql` — Row Level Security e funções de autorização
3. `supabase/migrations/0003_storage.sql` — buckets privados `media` e `documents` e suas políticas
4. `supabase/migrations/0004_lgpd.sql` — apoio à exportação/exclusão de dados

Com a CLI do Supabase, alternativamente: `supabase link --project-ref <ref>` e `supabase db push`.

> As migrations foram validadas em PostgreSQL 16 local com stubs dos esquemas
> `auth` e `storage` (incluindo testes de RLS com três usuários). Rode-as primeiro
> num projeto de teste.

### Dados de demonstração (opcional)

Crie um usuário (Authentication → Users → Add user), copie o UUID e rode:

```sql
-- conteúdo de supabase/seed.sql, depois:
select public.seed_demo_trip('UUID-DO-USUARIO');
```

Os valores do seed são **estimativas fictícias**, identificadas como tal — não são cotações.

## 3. Autenticação

- **Authentication → Providers → Email**: mantenha "Confirm email" ligado.
- **Authentication → URL Configuration**:
  - Site URL: `https://seu-dominio` (ou `http://localhost:3000` no desenvolvimento)
  - Redirect URLs: `https://seu-dominio/auth/callback` e `http://localhost:3000/auth/callback`
- Recuperação de senha usa `/auth/callback?next=/auth/redefinir`.
- Recomendado: proteção contra senhas vazadas e CAPTCHA (Authentication → Attack Protection).

## 4. Armazenamento

A migration `0003` cria os buckets **privados**:

| Bucket | Conteúdo | Limite por arquivo | Escrita exige |
| --- | --- | --- | --- |
| `media` | fotos, vídeos, áudios, versões editadas | 1 GB | permissão `media` |
| `documents` | vouchers, comprovantes, bilhetes, seguros | 20 MB | permissão `reservations` |

O caminho é `<trip_id>/<uuid>.<ext>`; a primeira pasta define quem acessa. O navegador
só recebe **URLs assinadas válidas por 1 hora**. O limite global de upload do plano
(Storage → Settings) precisa ser ≥ ao limite do bucket.

Todo upload na nuvem passa por `POST /api/media/upload`, que verifica sessão,
permissão na viagem, caminho seguro e o **conteúdo real do arquivo** (assinatura
binária): SVG, HTML e executáveis são recusados mesmo renomeados.

## 5. Papéis e permissões

| Papel | Viagem | Orçamento/cotações | Reservas/documentos | Diário | Mídia/álbuns/vídeos |
| --- | --- | --- | --- | --- | --- |
| Proprietário | ✔ (único que exclui e convida) | ✔ | ✔ | ✔ | ✔ |
| Editor | ✔ | ✔ | ✔ | ✔ | ✔ |
| Financeiro | leitura | ✔ | ✔ | leitura | leitura |
| Colaborador | leitura | leitura | leitura | ✔ | ✔ |
| Leitor | leitura | leitura | leitura | leitura | leitura |

As permissões podem ser ajustadas individualmente (`trip_members.permissions`). O convite
(`POST /api/invites`) gera um link de uso único `/convite/<token>`.

## 6. Rodar localmente

```bash
cp .env.example .env.local   # preencha as variáveis
npm install
npm run dev                  # http://localhost:3000
```

## 7. Publicar no Vercel

1. Importe o repositório no Vercel e defina **Root Directory = `viajar-plus`**.
2. Em **Settings → Environment Variables**, cadastre as variáveis do `.env.example`
   (as sem `NEXT_PUBLIC_` ficam apenas no servidor).
3. Faça o deploy e adicione `https://<seu-app>.vercel.app/auth/callback` às Redirect URLs do Supabase.
4. Observação: o limitador de requisições é em memória por instância; para várias
   instâncias use um armazenamento compartilhado (ex.: Upstash Redis).

## 8. LGPD

- Exportação: Configurações → "Exportar meus dados" (`GET /api/account/export`).
- Exclusão: Configurações → "Excluir minha conta" (`POST /api/account/delete`, exige
  digitar `EXCLUIR MEUS DADOS` e `SUPABASE_SERVICE_ROLE_KEY` no servidor). Os arquivos
  das viagens próprias são apagados antes da conta; as viagens próprias somem em cascata.
- Preencha os dados do controlador em `/privacidade` antes de publicar.
