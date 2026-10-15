# Situação do projeto — implementado × pendente

Atualizado ao final da **Fase 4 (gestão e implantação)**. As quatro fases do plano foram implementadas; o que segue pendente está listado ao final.

## Implementado e testado

### Fundação
- Projeto Next.js 15 + TypeScript estrito, Tailwind, ESLint, Prisma/PostgreSQL.
- Migração versionada inicial, com trigger de imutabilidade da auditoria e restrições adicionais.
- Seed idempotente em dois modos (`demo` com dados fictícios; `base` para produção, com administrador inicial).
- `docker-compose.yml` (PostgreSQL 16 + Mailpit + aplicação opcional), `Dockerfile` multi-stage, `.env.example`.
- Documento OpenAPI 3.1 (`GET /api/openapi`) com teste que garante a documentação de todas as rotas.

### Autenticação (telas 1 e 2)
- Login, logout, recuperação e redefinição de senha por e-mail (adaptadores console/memória/SMTP).
- MFA TOTP obrigatório por papel, cadastro com QR Code, códigos de recuperação, anti-reutilização.
- Troca obrigatória de senha provisória; troca voluntária em "Minha conta".
- Bloqueio por tentativas (conta, IP, MFA), sessões com expiração por inatividade e absoluta, revogação automática.

### Estrutura organizacional (tela 4)
- Tipos de unidade e regras de subordinação configuráveis (tabela `org_unit_type`).
- Criar, editar, mover (com atualização das descendentes), inativar/reativar com justificativa; contatos autorizados; endereço.

### Usuários, papéis e permissões (telas 23 e 24)
- Cadastro de usuários com lotação e senha provisória; bloqueio/inativação/reativação com justificativa; redefinição de MFA.
- Atribuição de papéis por unidade (com ou sem subordinadas) e revogação imediata.
- Matriz de permissões por papel; criação de papéis; papéis de sistema protegidos.
- Anti-escalonamento, segregação (ninguém altera o próprio acesso), proteção do último administrador.

### Auditoria (tela 22)
- Eventos de login/falhas, alterações de cadastro, permissões, situações, consultas à trilha.
- Cadeia de hash, verificação de integridade pela interface, filtros e paginação, acesso restrito por escopo.

### Painel (tela 3, parcial)
- Indicadores reais da Fase 1: unidades por tipo, usuários por situação, usuários sem MFA, falhas/negativas em 24 h — todos do banco e restritos ao escopo.

### Fase 2 — Obras e documentos (telas 5–9, 19, 21 parcial, 25 e 26)
- Obras: código único `OB-AAAA-NNNNN` gerado de forma atômica; unidade, tipo, atividades, forma de execução, escopo, justificativa, prioridade, endereço, prazos e responsável.
- Máquina de estados validada no servidor (RASCUNHO … ARQUIVADA), com justificativa obrigatória para devolver, rejeitar, suspender, retomar, cancelar e reabrir; histórico completo; controle de concorrência por versão.
- Etapas com datas previstas e realizadas, avanço e alerta de atraso.
- Escopo de acesso por obra (papel "Responsável pela obra").
- Repositório documental: upload privado (disco local, memória ou S3 com criptografia no servidor), tipo verificado pelo conteúdo, SHA-256, versionamento com histórico de substituições, análise (iniciar/aprovar/rejeitar com motivo) com segregação, validade e vencimento, busca e filtros, download por URL temporária auditada.
- Matriz de requisitos configurável (classificação, base, fonte, versão normativa, revisão, etapa de verificação, bloqueio). Regras de NR iniciais **pendentes de confirmação**, sem efeito de bloqueio. Avaliação por obra, dispensa com justificativa e segregação.
- Aprovação central: fila de aprovações e documentos, cópia dos dados submetidos, parecer, documentos consultados, segregação de funções, número de decisões configurável, devolução e rejeição.
- Dossiê da obra em PDF (identificação, escopo, etapas, requisitos, documentos com hash, histórico e pareceres), com paginação e aviso de documento gerencial.
- Painel com obras por situação, documentos pendentes/vencidos/a vencer, etapas atrasadas e aprovações pendentes; filtros por região/unidade, tipo, situação e período.
- Rotina diária de vencimentos (`npm run jobs:daily`).

### Fase 3 — Segurança e pessoas (telas 10–16 e 20)
- Pessoas por categoria (profissional, empregado, voluntário, outro vínculo), com observação de avaliação jurídica do vínculo; sem dados de saúde.
- Qualificações, habilitações, registros em conselho, certificados e treinamentos, com validade e conferência em fonte oficial registrada manualmente.
- Vínculos com obras, atividades exercidas e registro da integração/orientação de segurança.
- Empresas com CNPJ validado, conferência cadastral manual (nunca automática), contratos, aditivos e ordens de serviço, documentos da empresa.
- Documentos associados a obra, pessoa, empresa ou equipamento.
- EPIs: catálogo (CA, validade, vida útil, mínimo), estoque por unidade com bloqueio contra saldo negativo inclusive em operações simultâneas, entregas individuais com confirmação de recebimento (sem simular assinatura), substituições com motivo, devoluções.
- Ferramentas, máquinas e equipamentos coletivos com inspeção, manutenção, defeito e interdição.
- Checklists configuráveis, inspeções com resultado por item, criticidade, observações e fotos; relatório de inspeção em PDF.
- Critérios de criticidade configuráveis (prazo, alerta prioritário, bloqueio).
- Riscos, incidentes e quase acidentes.
- Ações corretivas com responsável, prazo, evidência e validação por outra pessoa; não conformidades geram ações automaticamente; ações de nível bloqueante impedem iniciar, retomar ou enviar a obra para vistoria.
- Central de notificações com contador no cabeçalho; alertas por e-mail via adaptador.

### Fase 4 — Gestão e implantação (telas 3, 9, 17, 18, 19 e 21)
- Cronograma: gráfico de Gantt (previsto × realizado), dependências entre etapas com detecção de ciclo, motivo de atraso, marcos, linhas de base versionadas e desvio em dias por etapa.
- Diário de obra somente inclusão (sem edição ou exclusão).
- Mudança de escopo após a aprovação: sempre pela aprovação central, com escopo anterior preservado.
- Orçamento por versões (rascunho → em aprovação → aprovado/substituído), linhas por categoria com identificador estável entre versões, cálculo exato em decimal, vínculo com contrato/aditivo.
- Lançamentos contratados, comprometidos (passam por aprovação de despesa) e pagos (apenas registro — sem pagamento automático); cancelamento com trilha.
- Medições sobre os itens do orçamento aprovado, com aviso quando a quantidade acumulada supera a orçada, aprovação central.
- Resumo por categoria (orçado, contratado, comprometido, medido, pago, saldo) e alerta de desvio com percentual configurável.
- Alçadas por valor opcionais por tipo (faixas → quantidade de decisões), sem nenhum limite pré-definido; segregação de funções preservada.
- Aprovação central genérica para orçamento, medição, despesa e mudança de escopo, com cópia dos dados submetidos.
- Tela de orçamentos (visão por obra) e indicadores financeiros e de segurança no painel.
- Catálogo de relatórios em PDF (13 tipos, incluindo dossiê, resumo executivo, documentos pendentes, plano de ações, EPIs, cronograma, orçamento e medições, fotográfico, termo de vistoria, encerramento, visão consolidada por região e auditoria), sempre restritos ao escopo e auditados.
- Parâmetros do sistema (desvio orçamentário, retenção, prazo interno de resposta a titulares), com limites e auditoria.
- Atendimento a titulares (LGPD): registro, prazo interno, exportação dos dados em JSON, encerramento com resposta e anonimização do cadastro de pessoa.
- Rotina diária com retenção de tentativas de login e sessões; ancoragem do hash da auditoria (`npm run audit:anchor`).
- Varredura automatizada de segurança nas rotas reais: CSRF (Origin), autenticação obrigatória e IDOR entre regiões.

### Testes
- Unidade: autorização, criptografia, senha, TOTP, higienização, CSRF, redirecionamento seguro, OpenAPI.
- Integração (PostgreSQL real): isolamento entre regiões, autenticação, MFA, recuperação de senha, auditoria, papéis.
- E2E (Playwright, build de produção): fluxos de login, CSP, isolamento na interface e na API, cadastro de MFA, criação de unidade, auditoria, anti-escalonamento, ciclo da obra com aprovação e dossiê, inspeção de segurança, orçamento → aprovação → medição, diário, cronograma, relatórios, parâmetros, alçadas, privacidade e layout em celular.
- Última execução: 109 testes de unidade/integração e 11 E2E aprovados.

## Pendente

| Item | Observação |
| --- | --- |
| Uso offline (service worker) | O app é instalável (manifesto), mas não funciona sem conexão. |
| Validação institucional | Papéis, fluxos, alçadas, criticidades e regras de NR são exemplos técnicos e seguem **pendentes de validação formal**. |
| Ancoragem externa automática | `npm run audit:anchor` gera o registro; publicá-lo em local externo (e-mail, cartório digital, repositório) é passo operacional. |
| Assinatura digital | Os PDFs são gerenciais; integração com assinatura qualificada não foi feita. |
| Rate limit distribuído | O limite geral é por instância (ver `seguranca.md`). |
| Execução do `docker-compose.yml` | Não executado no ambiente de desenvolvimento usado. |

## Limitações conhecidas

- Rate limit geral em memória (por instância) — ver `seguranca.md`.
- Instalação no celular via manifesto (PWA); sem modo offline ainda.
- O registro de entrega de EPI e a confirmação de recebimento não substituem termo assinado; o sistema só registra como a confirmação foi feita.
- Navegação: o indicador de carregamento aparece no link clicado (menu e abas); um `loading.tsx` por rota foi removido porque fazia o roteador descartar navegações feitas logo após outra.
- O `docker-compose.yml` (incluindo o MinIO opcional) não pôde ser executado no ambiente de desenvolvimento usado; os testes rodaram com PostgreSQL local e armazenamento em memória/disco.
- Nenhuma regra institucional ou normativa foi cadastrada: papéis de exemplo são apenas ponto de partida técnico.
