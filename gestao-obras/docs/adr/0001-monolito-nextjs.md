# ADR 0001 — Monólito modular em Next.js com camada de serviços

**Situação:** aceita (Fase 1)

**Contexto.** Equipe pequena, custo inicial controlado, necessidade de
interface responsiva e API documentada.

**Decisão.** Um único aplicativo Next.js (App Router) com Route Handlers para a
API e uma camada `src/server/services` que concentra regras e autorização.
Páginas chamam os serviços diretamente no servidor; o navegador usa a API.

**Consequências.** Implantação simples (um contêiner + PostgreSQL). A separação
em serviços permite extrair módulos no futuro, se necessário. Toda nova
funcionalidade deve passar pelos serviços — nunca acessar o Prisma direto de
uma tela para operações de escrita.
