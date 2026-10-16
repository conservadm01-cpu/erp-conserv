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

| Pessoas que atuam em obras: nome, categoria do vínculo, função, contato, identificação interna opcional, unidade | Organização das equipes e controle de qualificações e segurança | Legítimo interesse / obrigação legal conforme o vínculo (validar) | Enquanto houver vínculo + prazo de guarda definido |
| Qualificações, treinamentos e certificados (nome, número, validade, arquivo) | Comprovar habilitação para atividades de risco | Obrigação legal quando aplicável / legítimo interesse | Conforme exigência aplicável |
| Entregas de EPI (item, quantidade, data, forma de confirmação) | Comprovar fornecimento de proteção | Obrigação legal quando aplicável | Conforme exigência aplicável |
| Incidentes e quase acidentes (descrição do fato, sem dados de saúde) | Prevenção e correção | Legítimo interesse / obrigação legal | Período definido |

O cadastro de pessoas **não** possui campos de saúde, diagnóstico, exames ou
prontuário, e as telas orientam a não enviar esses documentos. A categoria
"voluntário" não presume dispensa de obrigações: o campo de avaliação jurídica
do vínculo existe para registrar essa análise. Módulos futuros seguirão o mesmo princípio:
**coletar somente o necessário**, com finalidade registrada. Dados de saúde, se
um dia forem necessários, ficarão em estrutura segregada, com acesso mínimo e
justificativa documentada — e somente após validação jurídica.

## Medidas técnicas

- Minimização: cadastros sem CPF/RG nesta fase; campos de contato opcionais.
- Controle de acesso por escopo e registro de acessos à trilha de auditoria.
- Senhas e tokens nunca armazenados em claro; segredos MFA cifrados.
- Logs de auditoria sem senhas, tokens ou códigos (higienização automática).
- Dados de demonstração 100% fictícios (domínio reservado `.test`).

## Saúde ocupacional (ASO)

O ASO é dado pessoal sensível. O sistema o trata assim:

- registra **somente** o tipo do exame, a conclusão (apto/inapto), as atividades
  para as quais houve aptidão e a validade — não há campos para diagnósticos,
  resultados de exames ou observações clínicas;
- o arquivo do ASO fica na categoria restrita "ASO": só quem tem as permissões
  `health.read`/`health.manage` naquela unidade (no exemplo, o Técnico de
  segurança) e o próprio titular conseguem ver, listar ou baixar;
- a auditoria registra o acesso e a conferência, sem o título nem dados do exame;
- avisos de vencimento vão apenas para quem tem a permissão de saúde, sem detalhes;
- o titular pode enviar o próprio ASO pelo portal; ele fica "aguardando
  conferência" até alguém com permissão de saúde conferir o documento original.

A necessidade de exigir ASO de voluntários (e quais atividades o exigem) depende
de avaliação jurídica: por isso as exigências por atividade começam **pendentes
de validação** e só bloqueiam vínculos depois de validadas, com base e data de
revisão registradas.

## Direitos dos titulares (fluxo proposto)

1. Pedido recebido pelo canal do encarregado.
2. Confirmação de identidade do titular.
3. Localização dos dados (usuário, contatos de unidade, auditoria).
4. Atendimento: acesso, correção (tela de usuários/unidades), anonimização ou
   eliminação quando cabível — a trilha de auditoria pode ter guarda
   obrigatória e deve ser avaliada caso a caso.
5. Registro do atendimento e resposta no prazo legal.

O módulo **Administração → Privacidade (titulares)**, restrito à gestão central
(permissão `privacy.manage`), implementa esse fluxo:

- localização do titular (usuário ou pessoa cadastrada) por nome ou e-mail;
- registro do pedido (tipo, canal, descrição) com prazo interno calculado a
  partir do parâmetro `privacy.responseDays` — o prazo legal deve ser
  confirmado pelo encarregado;
- exportação dos dados mantidos pelo sistema em JSON (cadastro, vínculos,
  qualificações, entregas de EPI, sessões e atividades registradas), auditada;
- encerramento como atendida ou recusada, com resposta registrada e, para
  pessoas cadastradas, anonimização dos dados identificadores (os registros de
  obra e segurança permanecem sem identificar o titular);
- a trilha de auditoria é imutável e não é alterada pela anonimização.

Retenção: a rotina diária descarta tentativas de login e sessões encerradas
mais antigas que os prazos configurados em **Configurações → Parâmetros**.

## Resposta a incidentes (procedimento proposto)

1. **Detecção**: alertas de falhas/negativas no painel e na auditoria; verificação de integridade da cadeia.
2. **Contenção**: bloquear usuários envolvidos, revogar sessões (bloqueio/inativação revoga automaticamente), trocar segredos (`APP_ENCRYPTION_KEY` exige re-cadastro de MFA).
3. **Avaliação**: usar `correlationId` e a trilha para reconstruir os fatos.
4. **Comunicação**: encarregado avalia comunicação à ANPD e aos titulares, conforme a regulamentação vigente.
5. **Lições aprendidas**: registrar causa e correções.
