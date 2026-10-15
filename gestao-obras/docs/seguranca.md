# Segurança — controles implementados (Fase 1)

| Controle | Como foi implementado | Onde |
| --- | --- | --- |
| Senhas | bcrypt custo 12; mínimo 12 caracteres, 3 classes, sem nome/e-mail, lista de senhas comuns | `server/auth/password.ts` |
| Sessão | Token aleatório de 256 bits; cookie `httpOnly`, `SameSite=Lax`, `Secure` + prefixo `__Host-` em HTTPS; banco guarda só SHA-256; expiração por inatividade (60 min) e absoluta (12 h) | `server/auth/session.ts` |
| MFA | TOTP (30 s, janela ±1) com segredo cifrado AES-256-GCM, anti-reutilização por passo de tempo (atômico no banco), 8 códigos de recuperação de uso único; obrigatório por papel | `server/auth/mfa.ts`, `services/auth.service.ts` |
| Força bruta | Bloqueio persistido: 5 falhas/15 min por conta, 30 por IP, 5 códigos MFA inválidos encerram a sessão; rate limit em memória nas rotas públicas | `services/auth.service.ts`, `http/rate-limit.ts` |
| Enumeração de contas | Mesma mensagem e tempo equivalente (hash fictício) para e-mail inexistente; recuperação de senha sempre responde igual | `auth.service.ts` |
| Recuperação de senha | Token de 256 bits, só o hash no banco, validade 30 min, uso único (consumo atômico), invalida tokens anteriores, encerra todas as sessões | `auth.service.ts` |
| Autorização | Sempre no servidor, nos serviços; escopo por caminho organizacional; 404 fora do escopo; anti-escalonamento; segregação (não altera o próprio acesso); proteção do último administrador | `server/authz`, `services/*` |
| CSRF | `SameSite=Lax` + verificação obrigatória do cabeçalho `Origin` em POST/PUT/PATCH/DELETE | `http/handler.ts` |
| XSS | React escapa saídas; CSP com nonce por requisição e `strict-dynamic`; sem `dangerouslySetInnerHTML` | `middleware.ts` |
| Clickjacking / outros cabeçalhos | `frame-ancestors 'none'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP | `next.config.ts`, `middleware.ts` |
| Injeção | Prisma com consultas parametrizadas; SQL bruto apenas via template tag parametrizada | serviços |
| Validação | Zod em todas as entradas; limite de 1 MB no corpo | `server/validation`, `http/handler.ts` |
| Redirecionamento aberto | `next` após login só aceita caminhos internos | `lib/api.ts` (`safeNext`) |
| Erros | Mensagens padronizadas sem stack trace; `correlationId` em toda resposta e log | `http/handler.ts` |
| Segredos | Somente por variáveis de ambiente; aplicação recusa iniciar em produção sem `APP_ENCRYPTION_KEY` | `server/env.ts` |
| Auditoria | Append-only (trigger), cadeia de hash, higienização de metadados sensíveis, consulta à trilha também auditada | `server/audit` |

## Limitações conhecidas / próximos passos

- Rate limit geral é por instância (memória). Com várias instâncias, usar um
  armazenamento compartilhado (ex.: Redis) ou o limitador do proxy/WAF.
- `TRUST_PROXY=true` só atrás de proxy confiável, senão o IP pode ser forjado.
- Criptografia em repouso do banco e dos backups depende da infraestrutura
  (disco/volume cifrado, backups cifrados) — ver `implantacao.md`.
- Ancoragem externa periódica do último hash de auditoria (Fase 4).
- Testes de segurança automatizados adicionais (DAST) previstos para a Fase 4.
