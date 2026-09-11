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

---

# Academia ConServ

> **Conhecimento que vira qualidade.**

Este repositório passou a abrigar **duas aplicações** que compartilham o
mesmo deploy e o mesmo banco:

| Aplicação | Endereço | Entrada |
|---|---|---|
| ERP ConServ (produção, estoque, compras) | `/` | `index.html` → `src/main.jsx` |
| **Academia ConServ** (capacitação) | `/academia.html` | `academia.html` → `src/academia/main.tsx` |

O ERP continua exatamente como estava: a Academia foi acrescentada ao
lado, em React + TypeScript + Tailwind, sem alterar uma linha de
`src/App.jsx`.

## O que a Academia faz

- **Banco de Conhecimento**: o administrador envia PDF, DOCX, PPTX, TXT,
  imagem, vídeo, URL ou texto. A plataforma extrai o conteúdo, analisa e
  sugere aulas, questões, curiosidades, desafios e jogos — tudo com a
  **fonte registrada** (SOURCE_ID apontando para o trecho de origem).
- **Nada é publicado sem aprovação humana.**
- **Trilhas, cursos, aulas, quizzes, jogos, desafios e apostilas** são
  dados: crescem pelo painel, sem mexer no código.
- **Certificados** com código único, QR Code e página pública de validação
  (`/#/validar-certificado/<código>`).
- **Matriz de competências** (6 níveis) com lacunas por função e
  recomendação de treinamento.
- **Gamificação** com XP, níveis e badges — ranking opcional e por adesão.
- **“Eu vi um risco”** com painel de tratamento para gestores.
- **“Aprender no posto”**: máquina + sintoma → verificações educativas
  tiradas dos materiais publicados, com limite claro de segurança.
- **Relatórios** de conclusão, desempenho, lacunas e riscos.

Carga inicial: 5 cursos, 25 aulas, 56 questões, 32 curiosidades, 6 jogos,
12 desafios, 14 badges, 17 trilhas, 12 materiais técnicos, 1 apostila
gerada pelo motor e 2 certificados de exemplo.

## Rodando

```bash
npm install
npm run dev             # ERP em /  ·  Academia em /academia.html
npm run typecheck       # TypeScript estrito
npm run test:academia   # 93 verificações: motores + integridade do conteúdo
npm run build           # gera as duas aplicações
```

Varredura no navegador (opcional — abre todas as telas no computador e no
celular, roda os fluxos de ponta a ponta e as regressões já corrigidas):

```bash
npm i -D playwright && npx playwright install chromium   # uma vez
npm run build && npm run preview                         # num terminal
npm run smoke:academia                                   # noutro terminal
```

A varredura inclui a leitura de PDF: ela gera um PDF de duas páginas na
hora (`scripts/lib/pdf-de-teste.mjs`), envia na tela de novo conteúdo e
confere que o texto foi extraído, que a análise usou esse texto e que a
página do PDF ficou registrada como fonte.

### Publicar em hospedagem estática

```bash
npm run build:publicacao        # gera dist-publicacao/ com caminhos relativos
```

Use este build quando a aplicação não for ficar na raiz do domínio (uma
pasta, uma pré-visualização hospedada). Ele também reescreve os bytes de
controle crus do arquivo auxiliar do leitor de PDF, que alguns
publicadores recusam — sem ele a leitura de PDF fica de fora.

### Sem Supabase configurado

O ERP exige Supabase. **A Academia não**: sem as variáveis de ambiente ela
cai automaticamente para o `localStorage` do navegador (modo demonstração,
dados só naquele aparelho). Com `VITE_SUPABASE_URL` e
`VITE_SUPABASE_ANON_KEY` configuradas, ela grava no mesmo banco do ERP, na
tabela `app_storage`, com todas as chaves prefixadas por `academia:v1:` —
os dois sistemas convivem sem se atrapalhar.

## Acessos de demonstração

Senha `1234` para todos (trocar no primeiro uso real):
`admin` (administrador), `patricia` (gestor), `sebastiao` (instrutor),
`maria` / `joana` / `antonio` (colaboradores).

## Documentação

- [`docs/academia/ARQUITETURA.md`](docs/academia/ARQUITETURA.md) — camadas,
  pastas, banco, fluxos (conteúdo, IA, quiz, jogos, certificado) e os
  pontos onde plugar banco real, storage, autenticação, IA e ERP.
- [`docs/academia/MANUAL-ADMIN.md`](docs/academia/MANUAL-ADMIN.md) — como
  alimentar a plataforma no dia a dia, sem programar.

## Aviso sobre conteúdo normativo

O material de NR-1 e demais normas é **educativo**. A plataforma exibe em
tela: *“Conteúdo educativo. Consulte a legislação e os responsáveis
técnicos da empresa para aplicação específica.”* Os certificados são de
**conclusão de treinamento interno** e não constituem, por si, certificação
oficial ou habilitação legal.
