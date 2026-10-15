# LGPD e proteção de dados

> Este documento é uma **proposta técnica** para apoiar a análise jurídica e
> institucional. Não substitui parecer jurídico nem define responsabilidades
> oficiais.

## Papéis de tratamento (a definir formalmente)

| Papel LGPD | Proposta para validação |
| --- | --- |
| Controlador | A instituição que decide sobre as finalidades do tratamento (a confirmar pelo jurídico). |
| Operador(es) | Prestadores que hospedam o sistema, o banco, o armazenamento de arquivos e o envio de e-mails, conforme contrato. |
| Encarregado (DPO) | A ser designado pelo controlador; contato a publicar no sistema. |

## Dados tratados na Fase 1

| Dado | Finalidade | Base legal sugerida (validar) | Retenção sugerida (validar) |
| --- | --- | --- | --- |
| Nome, e-mail, unidade de lotação do usuário | Identificação e controle de acesso | Legítimo interesse / execução de atividades | Enquanto ativo + prazo de guarda definido |
| Hash da senha, segredo MFA cifrado, códigos de recuperação (hash) | Autenticação segura | Legítimo interesse / segurança | Enquanto a conta existir |
| IP, navegador, data/hora de acesso, tentativas de login | Segurança e prevenção a fraudes | Legítimo interesse; cumprimento de obrigação legal quando aplicável | Período definido na política de retenção |
| Contatos autorizados das unidades (nome, função, e-mail, telefone) | Comunicação administrativa | Consentimento ou legítimo interesse, conforme o caso | Enquanto o contato estiver vigente |
| Trilha de auditoria | Rastreabilidade e responsabilização | Legítimo interesse / obrigação legal | Período definido; descarte por expurgo controlado |

Não há dados de saúde, documentos pessoais ou dados sensíveis na Fase 1. Os
módulos futuros (profissionais, voluntários, EPIs) seguirão o mesmo princípio:
**coletar somente o necessário**, com finalidade registrada. Dados de saúde, se
um dia forem necessários, ficarão em estrutura segregada, com acesso mínimo e
justificativa documentada — e somente após validação jurídica.

## Medidas técnicas

- Minimização: cadastros sem CPF/RG nesta fase; campos de contato opcionais.
- Controle de acesso por escopo e registro de acessos à trilha de auditoria.
- Senhas e tokens nunca armazenados em claro; segredos MFA cifrados.
- Logs de auditoria sem senhas, tokens ou códigos (higienização automática).
- Dados de demonstração 100% fictícios (domínio reservado `.test`).

## Direitos dos titulares (fluxo proposto)

1. Pedido recebido pelo canal do encarregado.
2. Confirmação de identidade do titular.
3. Localização dos dados (usuário, contatos de unidade, auditoria).
4. Atendimento: acesso, correção (tela de usuários/unidades), anonimização ou
   eliminação quando cabível — a trilha de auditoria pode ter guarda
   obrigatória e deve ser avaliada caso a caso.
5. Registro do atendimento e resposta no prazo legal.

Um módulo de atendimento a titulares com exportação dos dados está previsto
para a Fase 4.

## Resposta a incidentes (procedimento proposto)

1. **Detecção**: alertas de falhas/negativas no painel e na auditoria; verificação de integridade da cadeia.
2. **Contenção**: bloquear usuários envolvidos, revogar sessões (bloqueio/inativação revoga automaticamente), trocar segredos (`APP_ENCRYPTION_KEY` exige re-cadastro de MFA).
3. **Avaliação**: usar `correlationId` e a trilha para reconstruir os fatos.
4. **Comunicação**: encarregado avalia comunicação à ANPD e aos titulares, conforme a regulamentação vigente.
5. **Lições aprendidas**: registrar causa e correções.
