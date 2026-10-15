# Implantação em produção

## Requisitos

- PostgreSQL 16 gerenciado (com backups automáticos, PITR e disco cifrado).
- Execução de contêiner (Docker) ou Node.js 22 atrás de proxy reverso com HTTPS.
- Servidor SMTP institucional ou serviço de e-mail transacional.

## Passos

1. **Banco**: crie o banco e aplique `prisma/sql/producao-papeis.sql` (ajuste
   as senhas). A aplicação usa `obras_app`; migrações usam `obras_owner`.
2. **Variáveis** (no gerenciador de segredos do provedor, nunca em arquivo versionado):
   - `DATABASE_URL` com o usuário `obras_app` e `sslmode=require`;
   - `APP_URL=https://seu-dominio`;
   - `APP_ENCRYPTION_KEY` (32 bytes base64, gerada uma vez e guardada com segurança — perdê-la invalida os MFAs cadastrados);
   - `TRUST_PROXY=true` somente se houver proxy confiável à frente;
   - `MAIL_DRIVER=smtp` e `SMTP_*`;
   - `STORAGE_DRIVER=s3` e `S3_*` (bucket privado, sem acesso público, com versionamento e criptografia habilitados) — ou `STORAGE_DRIVER=local` com `STORAGE_LOCAL_DIR` em volume persistente e com backup.
3. **Migrações** (com `obras_owner`): `npx prisma migrate deploy`.
4. **Dados iniciais**: `SEED_MODE=base SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... npm run db:seed`.
   O administrador inicial deverá trocar a senha e cadastrar MFA no primeiro acesso.
   **Nunca** use `SEED_MODE=demo` em produção (o seed recusa).
5. **Aplicação**: `docker build -t gestao-obras .` e execute com as variáveis acima,
   ou `npm ci && npx next build && npx next start`.
6. **Proxy/HTTPS**: TLS 1.2+, HSTS (`Strict-Transport-Security: max-age=31536000; includeSubDomains`), limite de tamanho de corpo e rate limit.
7. **Rotina diária**: agende `npm run jobs:daily` (vencimento de documentos).
8. **Monitoramento**: `GET /api/health` para verificação de disponibilidade; coletar logs (contêm `correlationId`, sem dados sensíveis).

## Checklist antes de colocar dados reais

- [ ] Validação jurídica/LGPD (`docs/lgpd.md`) e definição de controlador/operadores.
- [ ] Papéis e permissões revistos pelos responsáveis autorizados.
- [ ] Teste de restauração de backup realizado e registrado.
- [ ] Usuário de banco da aplicação sem privilégios de DDL nem de alteração da auditoria.
- [ ] HTTPS ativo; cookies com prefixo `__Host-` confirmados.
- [ ] Rotina de revisão periódica de acessos definida.
