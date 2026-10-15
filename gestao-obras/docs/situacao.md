# Situação do projeto — implementado × pendente

Atualizado ao final da **Fase 3 (segurança e pessoas)**.

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

### Testes
- Unidade: autorização, criptografia, senha, TOTP, higienização, CSRF, redirecionamento seguro, OpenAPI.
- Integração (PostgreSQL real): isolamento entre regiões, autenticação, MFA, recuperação de senha, auditoria, papéis.
- E2E (Playwright, build de produção): fluxos de login, CSP, isolamento na interface e na API, cadastro de MFA, criação de unidade, auditoria, anti-escalonamento, layout em celular.

## Pendente (próximas fases)

| Fase | Itens |
| --- | --- |
| 4 — Gestão e implantação | Cronograma com linha de base e dependências; orçamento, medições e aditivos; painel consolidado com filtros; relatórios PDF completos; alçadas e fluxos configuráveis; atendimento a titulares; ancoragem externa do hash de auditoria; testes de segurança adicionais; service worker (uso offline). |

Telas da lista original ainda não implementadas: 17 (orçamentos) e 18 (medições); a tela 21 (relatórios) tem o dossiê da obra e o relatório de inspeção.

## Limitações conhecidas da Fase 1

- Rate limit geral em memória (por instância) — ver `seguranca.md`.
- Instalação no celular via manifesto (PWA); sem modo offline ainda.
- O registro de entrega de EPI e a confirmação de recebimento não substituem termo assinado; o sistema só registra como a confirmação foi feita.
- Navegação: o indicador de carregamento aparece no link clicado (menu e abas); um `loading.tsx` por rota foi removido porque fazia o roteador descartar navegações feitas logo após outra.
- Alçadas por valor financeiro dependem do módulo de orçamento (Fase 4).
- O `docker-compose.yml` (incluindo o MinIO opcional) não pôde ser executado no ambiente de desenvolvimento usado; os testes rodaram com PostgreSQL local e armazenamento em memória/disco.
- Nenhuma regra institucional ou normativa foi cadastrada: papéis de exemplo são apenas ponto de partida técnico.
