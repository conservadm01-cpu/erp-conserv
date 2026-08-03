# Controle de Produção — Confecção

App de controle de produção, materiais, compras, colaboradores e
relatórios para confecção, adaptado para rodar como site normal
(hospedado no Vercel) com o Supabase como banco de dados compartilhado.

## 1. Criar o projeto no Supabase

1. Crie um projeto em https://supabase.com (plano gratuito serve).
2. Vá em **SQL Editor → New query**, cole o conteúdo de
   `supabase/schema.sql` e clique em **Run**. Isso cria a tabela
   `app_storage` (onde tudo é salvo) e as permissões de acesso.
3. Vá em **Project Settings → API**. Você vai precisar de dois valores:
   - **Project URL** (algo como `https://xxxx.supabase.co`)
   - **anon public key** (uma chave longa, começa geralmente com `eyJ...`)

## 2. Rodar localmente (opcional, para testar antes do deploy)

```bash
npm install
cp .env.example .env
# edite o .env e cole a URL e a chave anônima do seu projeto Supabase
npm run dev
```

Abra o endereço que aparecer no terminal (normalmente
`http://localhost:5173`).

## 3. Publicar no Vercel

1. Suba esta pasta para o seu repositório no GitHub (se ainda não
   subiu):
   ```bash
   git init
   git add .
   git commit -m "Controle de produção — confecção"
   git branch -M main
   git remote add origin <URL do seu repositório>
   git push -u origin main
   ```
2. No painel do Vercel, clique em **Add New → Project** e importe esse
   repositório.
3. O Vercel detecta automaticamente que é um projeto Vite (build
   command `vite build`, output `dist`) — não precisa mexer em nada
   nessa parte.
4. Antes de clicar em **Deploy**, abra **Environment Variables** e
   adicione:
   - `VITE_SUPABASE_URL` → a Project URL do Supabase
   - `VITE_SUPABASE_ANON_KEY` → a anon public key do Supabase
5. Clique em **Deploy**. Em ~1 minuto o app estará no ar num endereço
   `https://seu-projeto.vercel.app`.

Sempre que você alterar as variáveis de ambiente depois do primeiro
deploy, é preciso rodar um novo deploy (Vercel → seu projeto →
**Deployments → ⋯ → Redeploy**) para elas valerem.

## Como os dados são salvos

O app original (feito para rodar dentro do Claude) usa uma API chamada
`window.storage` para guardar tudo — materiais, produtos, ordens de
produção, colaboradores etc. Essa API só existe dentro do Claude, então
o arquivo `src/storage.js` recria a mesma interface (`get`, `set`,
`delete`, `list`) só que gravando numa única tabela do Supabase
(`app_storage`, uma linha por registro). O `src/App.jsx` é o app
inteiro, sem nenhuma alteração de lógica — só passou a rodar num
projeto Vite comum.

Todos os dados são compartilhados entre todo mundo que acessa o app
(não existe separação "meus dados" vs "dados da empresa") — é assim
que o app já funcionava antes, então o comportamento é o mesmo.

## Sobre a senha dos colaboradores

A tela de login do app (nome + senha opcional) é um controle simples
de identificação, não uma autenticação real como login do Google ou
Supabase Auth. Qualquer pessoa com a chave anônima do seu Supabase
(que fica visível no código do site, como acontece em qualquer app só
de frontend) consegue ler e alterar os dados diretamente pela API do
Supabase, sem passar pela tela de login do app. Para uso interno numa
fábrica isso costuma ser aceitável, mas não é o nível de segurança
adequado para dados sensíveis de verdade (ex.: dados financeiros
críticos). Se isso for uma preocupação, o próximo passo seria mover as
operações de escrita para funções serverless (Vercel Functions) que
validam um token antes de falar com o Supabase, em vez do navegador
falar direto com o banco.

## Estrutura do projeto

```
confeccao-erp/
├── index.html
├── package.json
├── vite.config.js
├── .env.example
├── supabase/
│   └── schema.sql        ← rode isso no SQL Editor do Supabase
└── src/
    ├── main.jsx           ← ponto de entrada, instala o storage
    ├── storage.js         ← window.storage refeito com Supabase
    └── App.jsx            ← o app inteiro (igual ao artifact original)
```
