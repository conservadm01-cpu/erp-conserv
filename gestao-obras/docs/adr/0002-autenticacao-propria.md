# ADR 0002 — Autenticação própria com sessão opaca e TOTP

**Situação:** aceita (Fase 1)

**Contexto.** É preciso MFA por papel, bloqueio por tentativas, auditoria de
cada etapa e funcionamento local sem credenciais de serviços externos.

**Decisão.** Implementar autenticação no próprio sistema:
- senhas com bcrypt (custo 12) e política mínima;
- sessão opaca: token aleatório de 256 bits em cookie `httpOnly`,
  `SameSite=Lax`, `Secure`/`__Host-` em HTTPS; o banco guarda só o SHA-256;
- expiração por inatividade e absoluta; revogação em troca de senha, bloqueio,
  redefinição de MFA;
- TOTP (RFC 6238) com segredo cifrado em AES-256-GCM, proteção contra
  reutilização do código e 8 códigos de recuperação de uso único;
- bloqueio persistido no banco por conta (5 falhas/15 min) e por IP (30/15 min).

**Alternativas.** Provedor de identidade externo (OIDC) — recomendado como
evolução quando houver um IdP institucional; a camada `auth/` foi isolada para
permitir essa troca.

**Consequências.** Mais código sob responsabilidade do projeto, coberto por
testes de integração específicos.
