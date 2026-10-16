/**
 * Documento OpenAPI 3.1 da API. Um teste automatizado garante que toda rota
 * em src/app/api esteja descrita aqui.
 */
type Op = { summary: string; tag: string; auth?: "publica" | "parcial" | "completa"; body?: Record<string, unknown>; params?: string[]; query?: Record<string, unknown> };

const err = { $ref: "#/components/responses/Erro" };

function op(o: Op) {
  const auth = o.auth ?? "completa";
  return {
    summary: o.summary,
    tags: [o.tag],
    ...(auth === "publica" ? { security: [] } : {}),
    ...(auth === "parcial" ? { description: "Aceita sessão com verificação pendente (MFA ou troca de senha)." } : {}),
    parameters: [
      ...(o.params ?? []).map((name) => ({ name, in: "path", required: true, schema: { type: "string", format: "uuid" } })),
      ...Object.entries(o.query ?? {}).map(([name, schema]) => ({ name, in: "query", required: false, schema })),
    ],
    ...(o.body
      ? { requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: o.body } } } } }
      : {}),
    responses: {
      "200": { description: "Sucesso" },
      "401": err,
      "403": err,
      "404": err,
      "422": err,
      "429": err,
    },
  };
}

const s = { type: "string" };
const b = { type: "boolean" };
const u = { type: "string", format: "uuid" };

const address = { street: s, number: s, complement: s, district: s, city: s, state: s, postalCode: s };
const contacts = { type: "array", items: { type: "object", properties: { name: s, role: s, email: s, phone: s } } };

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Gestão de Obras — API",
    version: "1.0.0",
    description:
      "API completa (Fases 1 a 4). Autenticação por cookie de sessão httpOnly. Requisições de alteração devem enviar o cabeçalho Origin da própria aplicação.",
  },
  servers: [{ url: "/" }],
  security: [{ sessao: [] }],
  components: {
    securitySchemes: { sessao: { type: "apiKey", in: "cookie", name: "go_session", description: "Em HTTPS o nome é __Host-go_session." } },
    responses: {
      Erro: {
        description: "Erro padronizado",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: { error: { type: "object", properties: { code: s, message: s, details: {}, correlationId: s } } },
            },
          },
        },
      },
    },
  },
  paths: {
    "/api/health": { get: op({ summary: "Verificação de saúde", tag: "Sistema", auth: "publica" }) },
    "/api/openapi": { get: op({ summary: "Este documento", tag: "Sistema", auth: "publica" }) },
    "/api/auth/login": { post: op({ summary: "Entrar com e-mail e senha", tag: "Autenticação", auth: "publica", body: { email: s, password: s } }) },
    "/api/auth/logout": { post: op({ summary: "Encerrar a sessão", tag: "Autenticação", auth: "parcial" }) },
    "/api/auth/session": { get: op({ summary: "Estado da sessão e permissões", tag: "Autenticação", auth: "parcial" }) },
    "/api/auth/mfa/verify": { post: op({ summary: "Validar código TOTP ou de recuperação", tag: "Autenticação", auth: "parcial", body: { code: s } }) },
    "/api/auth/mfa/enrollment": { post: op({ summary: "Iniciar cadastro do autenticador", tag: "Autenticação", auth: "parcial" }) },
    "/api/auth/mfa/enrollment/confirm": { post: op({ summary: "Confirmar autenticador e gerar códigos de recuperação", tag: "Autenticação", auth: "parcial", body: { code: s } }) },
    "/api/auth/password/forgot": { post: op({ summary: "Solicitar redefinição de senha", tag: "Autenticação", auth: "publica", body: { email: s } }) },
    "/api/auth/password/reset": { post: op({ summary: "Redefinir senha com token", tag: "Autenticação", auth: "publica", body: { token: s, password: s } }) },
    "/api/auth/password/change": { post: op({ summary: "Trocar a própria senha", tag: "Autenticação", auth: "parcial", body: { currentPassword: s, newPassword: s } }) },
    "/api/dashboard": { get: op({ summary: "Indicadores do painel", tag: "Painel", query: { unitId: u, typeCode: s, status: s, from: s, to: s } }) },
    "/api/org-unit-types": { get: op({ summary: "Tipos de unidade e regras de hierarquia", tag: "Organização" }) },
    "/api/org-units": {
      get: op({ summary: "Listar unidades visíveis", tag: "Organização", query: { status: s, q: s } }),
      post: op({ summary: "Criar unidade", tag: "Organização", body: { code: s, name: s, typeCode: s, parentId: u, ...address, contacts } }),
    },
    "/api/org-units/{id}": {
      get: op({ summary: "Detalhar unidade", tag: "Organização", params: ["id"] }),
      patch: op({ summary: "Alterar ou mover unidade", tag: "Organização", params: ["id"], body: { name: s, parentId: u, ...address, contacts } }),
    },
    "/api/org-units/{id}/status": {
      post: op({ summary: "Inativar ou reativar unidade", tag: "Organização", params: ["id"], body: { status: s, reason: s } }),
    },
    "/api/users": {
      get: op({ summary: "Listar usuários", tag: "Usuários", query: { q: s, status: s, unitId: u } }),
      post: op({ summary: "Criar usuário", tag: "Usuários", body: { name: s, email: s, homeUnitId: u, temporaryPassword: s } }),
    },
    "/api/users/{id}": {
      get: op({ summary: "Detalhar usuário", tag: "Usuários", params: ["id"] }),
      patch: op({ summary: "Alterar usuário", tag: "Usuários", params: ["id"], body: { name: s, homeUnitId: u } }),
    },
    "/api/users/{id}/status": { post: op({ summary: "Alterar situação do usuário", tag: "Usuários", params: ["id"], body: { status: s, reason: s } }) },
    "/api/users/{id}/temporary-password": { post: op({ summary: "Definir senha provisória", tag: "Usuários", params: ["id"], body: { temporaryPassword: s } }) },
    "/api/users/{id}/mfa-reset": { post: op({ summary: "Redefinir MFA do usuário", tag: "Usuários", params: ["id"] }) },
    "/api/users/{id}/scopes": { post: op({ summary: "Conceder papel em unidade ou em obra específica", tag: "Usuários", params: ["id"], body: { roleId: u, unitId: u, workId: u, includeDescendants: b } }) },
    "/api/users/{id}/scopes/{scopeId}": { delete: op({ summary: "Revogar papel", tag: "Usuários", params: ["id", "scopeId"] }) },
    "/api/roles": {
      get: op({ summary: "Listar papéis", tag: "Permissões" }),
      post: op({ summary: "Criar papel", tag: "Permissões", body: { code: s, name: s, description: s, requiresMfa: b, permissions: { type: "array", items: s } } }),
    },
    "/api/roles/{id}": {
      patch: op({ summary: "Alterar papel e permissões", tag: "Permissões", params: ["id"], body: { name: s, description: s, requiresMfa: b, permissions: { type: "array", items: s } } }),
    },
    "/api/permissions": { get: op({ summary: "Catálogo de permissões", tag: "Permissões" }) },
    "/api/audit": {
      get: op({ summary: "Consultar trilha de auditoria", tag: "Auditoria", query: { action: s, actor: s, result: s, from: s, to: s, page: { type: "integer" }, pageSize: { type: "integer" } } }),
    },
    "/api/audit/verify": { post: op({ summary: "Verificar integridade da cadeia de hash", tag: "Auditoria" }) },
    "/api/work-catalogs": { get: op({ summary: "Tipos de obra, atividades e categorias documentais", tag: "Obras" }) },
    "/api/works": {
      get: op({ summary: "Listar obras no escopo", tag: "Obras", query: { q: s, status: s, typeCode: s, unitId: u } }),
      post: op({ summary: "Cadastrar obra (gera código único)", tag: "Obras", body: { unitId: u, title: s, typeCode: s, activities: { type: "array", items: s }, priority: s, executionMode: s, scope: s, justification: s, plannedStart: s, plannedEnd: s, responsibleName: s, ...address } }),
    },
    "/api/works/{id}": {
      get: op({ summary: "Detalhar obra, etapas, histórico e ações permitidas", tag: "Obras", params: ["id"] }),
      patch: op({ summary: "Alterar obra (exige a versão atual)", tag: "Obras", params: ["id"], body: { version: { type: "integer" }, title: s, scope: s, justification: s } }),
    },
    "/api/works/{id}/transitions": { post: op({ summary: "Executar transição de situação validada no servidor", tag: "Obras", params: ["id"], body: { action: s, reason: s, version: { type: "integer" } } }) },
    "/api/works/{id}/stages": { post: op({ summary: "Criar etapa", tag: "Obras", params: ["id"], body: { name: s, sortOrder: { type: "integer" }, status: s, plannedStart: s, plannedEnd: s, progress: { type: "integer" } } }) },
    "/api/works/{id}/stages/{stageId}": { patch: op({ summary: "Alterar etapa", tag: "Obras", params: ["id", "stageId"], body: { name: s, status: s, progress: { type: "integer" } } }) },
    "/api/works/{id}/documents": {
      get: op({ summary: "Documentos da obra com versões", tag: "Documentos", params: ["id"] }),
      post: op({ summary: "Enviar documento (multipart: file, categoryCode, title, issuer, documentNumber, issueDate, expiryDate)", tag: "Documentos", params: ["id"] }),
    },
    "/api/works/{id}/requirements": { get: op({ summary: "Requisitos aplicáveis e situação", tag: "Requisitos", params: ["id"] }) },
    "/api/works/{id}/requirements/{evaluationId}": { patch: op({ summary: "Registrar atendimento de requisito", tag: "Requisitos", params: ["id", "evaluationId"], body: { status: s, documentId: u, justification: s } }) },
    "/api/works/{id}/requirements/{evaluationId}/waive": { post: op({ summary: "Dispensar requisito com justificativa", tag: "Requisitos", params: ["id", "evaluationId"], body: { justification: s } }) },
    "/api/works/{id}/reports/dossie": { get: op({ summary: "Dossiê da obra em PDF", tag: "Relatórios", params: ["id"] }) },
    "/api/documents": { get: op({ summary: "Buscar documentos no escopo", tag: "Documentos", query: { q: s, status: s, categoryCode: s, expiring: s } }) },
    "/api/documents/{id}/versions": { post: op({ summary: "Enviar nova versão (multipart: file, changeNote, expiryDate)", tag: "Documentos", params: ["id"] }) },
    "/api/documents/{id}/review": { post: op({ summary: "Iniciar análise, aprovar ou rejeitar documento", tag: "Documentos", params: ["id"], body: { decision: s, note: s } }) },
    "/api/documents/{id}/versions/{versionId}/download": { post: op({ summary: "Obter URL temporária de download (auditado)", tag: "Documentos", params: ["id", "versionId"] }) },
    "/api/files/{token}": { get: { ...op({ summary: "Baixar arquivo com token temporário do próprio usuário", tag: "Documentos" }), parameters: [{ name: "token", in: "path", required: true, schema: s }] } },
    "/api/requirement-rules": {
      get: op({ summary: "Listar regras documentais", tag: "Requisitos" }),
      post: op({ summary: "Criar regra (nasce pendente de validação)", tag: "Requisitos", body: { code: s, name: s, evidence: s, classification: s, checkpoint: s, blocking: b } }),
    },
    "/api/requirement-rules/{id}": { patch: op({ summary: "Alterar regra (volta a pendente de validação)", tag: "Requisitos", params: ["id"] }) },
    "/api/requirement-rules/{id}/validate": { post: op({ summary: "Validar regra", tag: "Requisitos", params: ["id"], body: { lastReviewedAt: s, nextReviewAt: s, note: s } }) },
    "/api/requirement-rules/{id}/status": { post: op({ summary: "Inativar ou reativar regra", tag: "Requisitos", params: ["id"], body: { active: b } }) },
    "/api/approvals": { get: op({ summary: "Fila de aprovação central", tag: "Aprovações" }) },
    "/api/approvals/{id}": { get: op({ summary: "Detalhar aprovação", tag: "Aprovações", params: ["id"] }) },
    "/api/approvals/{id}/decision": { post: op({ summary: "Registrar decisão com parecer", tag: "Aprovações", params: ["id"], body: { decision: s, opinion: s, consultedDocumentIds: { type: "array", items: u } } }) },
    "/api/people": { get: op({ summary: "Listar pessoas (profissionais, voluntários e outros)", tag: "Pessoas", query: { category: s, q: s, status: s } }), post: op({ summary: "Cadastrar pessoa", tag: "Pessoas", body: { name: s, category: s, unitId: u, jobFunction: s, authorizedActivities: { type: "array", items: s } } }) },
    "/api/people/{id}": { get: op({ summary: "Detalhar pessoa", tag: "Pessoas", params: ["id"] }), patch: op({ summary: "Alterar pessoa", tag: "Pessoas", params: ["id"] }) },
    "/api/people/{id}/credentials": { post: op({ summary: "Registrar qualificação, habilitação, certificado ou treinamento", tag: "Pessoas", params: ["id"] }) },
    "/api/people/{id}/credentials/{credentialId}": { patch: op({ summary: "Registrar conferência em fonte oficial ou alterar situação", tag: "Pessoas", params: ["id", "credentialId"], body: { verifySource: s, status: s } }) },
    "/api/people/{id}/assignments": { post: op({ summary: "Vincular pessoa a obra", tag: "Pessoas", params: ["id"], body: { workId: u, role: s, startDate: s, safetyBriefingAt: s } }) },
    "/api/people/{id}/assignments/{assignmentId}": { patch: op({ summary: "Alterar vínculo (término, integração de segurança)", tag: "Pessoas", params: ["id", "assignmentId"] }) },
    "/api/people/{id}/documents": { post: op({ summary: "Enviar documento da pessoa (multipart)", tag: "Documentos", params: ["id"] }) },
    "/api/people/{id}/health": {
      get: op({ summary: "Listar ASO da pessoa (restrito à permissão de saúde)", tag: "Saúde ocupacional", params: ["id"] }),
      post: op({ summary: "Registrar ASO: conclusão, atividades liberadas e validade, com arquivo opcional (multipart)", tag: "Saúde ocupacional", params: ["id"] }),
    },
    "/api/people/{id}/health/{certificateId}": { patch: op({ summary: "Conferir ou inativar ASO", tag: "Saúde ocupacional", params: ["id", "certificateId"], body: { decision: s } }) },
    "/api/people/{id}/account": { put: op({ summary: "Vincular (ou desvincular, com e-mail vazio) a conta de acesso do titular", tag: "Pessoas", params: ["id"], body: { email: s } }) },
    "/api/me/profile": { get: op({ summary: "Portal do titular: próprio cadastro, qualificações, ASO, obras e pendências", tag: "Portal do titular" }) },
    "/api/me/credentials": { post: op({ summary: "Portal do titular: enviar comprovante (qualificação, treinamento, experiência) para conferência (multipart)", tag: "Portal do titular" }) },
    "/api/me/health": { post: op({ summary: "Portal do titular: enviar ASO para conferência (multipart)", tag: "Portal do titular" }) },
    "/api/agenda": {
      get: op({ summary: "Agenda de obras do mês (compromissos, etapas, marcos e inspeções previstas) no escopo do usuário", tag: "Agenda", query: { unitId: u, mes: s } }),
      post: op({ summary: "Agendar compromisso em unidade local (horário de Brasília)", tag: "Agenda", body: { unitId: u, kind: s, title: s, date: s, startTime: s } }),
    },
    "/api/agenda/{id}": { patch: op({ summary: "Concluir ou cancelar compromisso (com motivo)", tag: "Agenda", params: ["id"], body: { status: s, reason: s } }) },
    "/api/person-rules": { get: op({ summary: "Exigências por atividade para as pessoas", tag: "Requisitos" }) },
    "/api/person-rules/{id}": { patch: op({ summary: "Validar, inativar ou reativar exigência por atividade", tag: "Requisitos", params: ["id"], body: { action: s } }) },
    "/api/companies": { get: op({ summary: "Listar empresas", tag: "Empresas", query: { q: s, status: s } }), post: op({ summary: "Cadastrar empresa (CNPJ validado)", tag: "Empresas", body: { legalName: s, cnpj: s, unitId: u } }) },
    "/api/companies/{id}": { get: op({ summary: "Detalhar empresa", tag: "Empresas", params: ["id"] }), patch: op({ summary: "Alterar empresa", tag: "Empresas", params: ["id"] }) },
    "/api/companies/{id}/verification": { post: op({ summary: "Registrar conferência cadastral manual", tag: "Empresas", params: ["id"], body: { source: s } }) },
    "/api/companies/{id}/contracts": { post: op({ summary: "Cadastrar contrato, aditivo ou ordem de serviço", tag: "Empresas", params: ["id"] }) },
    "/api/companies/{id}/contracts/{contractId}": { patch: op({ summary: "Alterar situação do contrato", tag: "Empresas", params: ["id", "contractId"], body: { status: s } }) },
    "/api/companies/{id}/documents": { post: op({ summary: "Enviar documento da empresa (multipart)", tag: "Documentos", params: ["id"] }) },
    "/api/epi/catalog": { get: op({ summary: "Catálogo de EPIs", tag: "EPIs" }), post: op({ summary: "Incluir EPI no catálogo", tag: "EPIs" }) },
    "/api/epi/catalog/{id}": { put: op({ summary: "Alterar EPI do catálogo", tag: "EPIs", params: ["id"] }) },
    "/api/epi/stock": { get: op({ summary: "Saldos e movimentações de estoque", tag: "EPIs" }), post: op({ summary: "Registrar entrada, baixa ou ajuste", tag: "EPIs" }) },
    "/api/epi/deliveries": { get: op({ summary: "Entregas de EPI", tag: "EPIs", query: { personId: u, workId: u } }), post: op({ summary: "Registrar entrega de EPI", tag: "EPIs" }) },
    "/api/epi/deliveries/{id}": { patch: op({ summary: "Confirmar recebimento ou registrar devolução", tag: "EPIs", params: ["id"] }) },
    "/api/equipment": { get: op({ summary: "Listar ferramentas e equipamentos", tag: "Equipamentos", query: { q: s, status: s } }), post: op({ summary: "Cadastrar equipamento", tag: "Equipamentos" }) },
    "/api/equipment/{id}": { get: op({ summary: "Detalhar equipamento", tag: "Equipamentos", params: ["id"] }), patch: op({ summary: "Alterar situação do equipamento", tag: "Equipamentos", params: ["id"] }) },
    "/api/equipment/{id}/logs": { post: op({ summary: "Registrar inspeção, manutenção ou defeito", tag: "Equipamentos", params: ["id"] }) },
    "/api/equipment/{id}/documents": { post: op({ summary: "Enviar documento do equipamento (multipart)", tag: "Documentos", params: ["id"] }) },
    "/api/safety/criticality": { get: op({ summary: "Critérios de criticidade", tag: "Segurança" }) },
    "/api/safety/criticality/{code}": { put: { ...op({ summary: "Alterar critério de criticidade", tag: "Segurança" }), parameters: [{ name: "code", in: "path", required: true, schema: s }] } },
    "/api/safety/checklists": { get: op({ summary: "Checklists", tag: "Segurança" }), post: op({ summary: "Criar checklist", tag: "Segurança" }) },
    "/api/safety/checklists/{id}": { put: op({ summary: "Alterar checklist", tag: "Segurança", params: ["id"] }) },
    "/api/safety/inspections": { get: op({ summary: "Listar inspeções", tag: "Segurança", query: { workId: u, status: s } }), post: op({ summary: "Planejar inspeção", tag: "Segurança" }) },
    "/api/safety/inspections/{id}": { get: op({ summary: "Detalhar inspeção", tag: "Segurança", params: ["id"] }), put: op({ summary: "Registrar resultados dos itens", tag: "Segurança", params: ["id"] }) },
    "/api/safety/inspections/{id}/complete": { post: op({ summary: "Concluir inspeção (gera ações para não conformidades)", tag: "Segurança", params: ["id"] }) },
    "/api/safety/inspections/{id}/report": { get: op({ summary: "Relatório de inspeção em PDF", tag: "Relatórios", params: ["id"] }) },
    "/api/safety/risks": { post: op({ summary: "Registrar risco", tag: "Segurança" }) },
    "/api/safety/risks/{id}": { patch: op({ summary: "Alterar risco", tag: "Segurança", params: ["id"] }) },
    "/api/safety/incidents": { post: op({ summary: "Registrar incidente ou quase acidente", tag: "Segurança" }) },
    "/api/safety/actions": { get: op({ summary: "Listar ações corretivas", tag: "Segurança", query: { workId: u, status: s, overdue: s } }), post: op({ summary: "Criar ação corretiva", tag: "Segurança" }) },
    "/api/safety/actions/{id}": { get: op({ summary: "Detalhar ação corretiva", tag: "Segurança", params: ["id"] }), post: op({ summary: "Avançar ação (iniciar, evidência, validar, reprovar, cancelar)", tag: "Segurança", params: ["id"] }) },
    "/api/works/{id}/safety": { get: op({ summary: "Segurança da obra (inspeções, riscos, incidentes, ações)", tag: "Segurança", params: ["id"] }) },
    "/api/works/{id}/team": { get: op({ summary: "Equipe vinculada à obra", tag: "Pessoas", params: ["id"] }) },
    "/api/notifications": { get: op({ summary: "Minhas notificações", tag: "Notificações", query: { unread: s } }), patch: op({ summary: "Marcar como lidas", tag: "Notificações", body: { ids: {} } }) },
    "/api/works/{id}/schedule": { get: op({ summary: "Cronograma: etapas, marcos e linhas de base", tag: "Cronograma", params: ["id"] }) },
    "/api/works/{id}/stages/{stageId}/schedule": { patch: op({ summary: "Dependências e justificativa de atraso da etapa", tag: "Cronograma", params: ["id", "stageId"], body: { dependsOnIds: { type: "array", items: u }, delayReason: s } }) },
    "/api/works/{id}/milestones": { post: op({ summary: "Criar marco", tag: "Cronograma", params: ["id"] }) },
    "/api/works/{id}/milestones/{milestoneId}": { put: op({ summary: "Alterar marco", tag: "Cronograma", params: ["id", "milestoneId"] }) },
    "/api/works/{id}/baselines": { post: op({ summary: "Definir nova linha de base", tag: "Cronograma", params: ["id"], body: { reason: s } }) },
    "/api/works/{id}/diary": { get: op({ summary: "Diário de obra", tag: "Obras", params: ["id"] }), post: op({ summary: "Registrar dia no diário (somente inclusão)", tag: "Obras", params: ["id"] }) },
    "/api/works/{id}/scope-changes": { get: op({ summary: "Mudanças de escopo", tag: "Obras", params: ["id"] }), post: op({ summary: "Solicitar mudança de escopo (vai à aprovação)", tag: "Obras", params: ["id"] }) },
    "/api/works/{id}/budget": { get: op({ summary: "Orçamentos, lançamentos, medições e resumo financeiro", tag: "Orçamento", params: ["id"] }) },
    "/api/works/{id}/budgets": { post: op({ summary: "Criar versão do orçamento", tag: "Orçamento", params: ["id"] }) },
    "/api/works/{id}/budgets/{budgetId}/lines": { post: op({ summary: "Incluir linha", tag: "Orçamento", params: ["id", "budgetId"] }) },
    "/api/works/{id}/budgets/{budgetId}/lines/{lineId}": { put: op({ summary: "Alterar linha", tag: "Orçamento", params: ["id", "budgetId", "lineId"] }), delete: op({ summary: "Remover linha (rascunho)", tag: "Orçamento", params: ["id", "budgetId", "lineId"] }) },
    "/api/works/{id}/budgets/{budgetId}/submit": { post: op({ summary: "Submeter orçamento à aprovação", tag: "Orçamento", params: ["id", "budgetId"] }) },
    "/api/works/{id}/costs": { post: op({ summary: "Registrar lançamento (comprometido vai à aprovação)", tag: "Orçamento", params: ["id"] }) },
    "/api/works/{id}/costs/{costId}": { delete: op({ summary: "Cancelar lançamento", tag: "Orçamento", params: ["id", "costId"] }) },
    "/api/works/{id}/measurements": { post: op({ summary: "Criar medição", tag: "Orçamento", params: ["id"] }) },
    "/api/works/{id}/measurements/{measurementId}": { put: op({ summary: "Alterar medição em rascunho", tag: "Orçamento", params: ["id", "measurementId"] }) },
    "/api/works/{id}/measurements/{measurementId}/submit": { post: op({ summary: "Submeter medição à aprovação", tag: "Orçamento", params: ["id", "measurementId"] }) },
    "/api/approval-tiers": { get: op({ summary: "Alçadas por valor", tag: "Aprovações" }) },
    "/api/approval-tiers/{kind}": { put: { ...op({ summary: "Substituir alçadas de um tipo", tag: "Aprovações" }), parameters: [{ name: "kind", in: "path", required: true, schema: s }] } },
    "/api/settings": { get: op({ summary: "Parâmetros do sistema", tag: "Configurações" }) },
    "/api/settings/{key}": { put: { ...op({ summary: "Alterar parâmetro", tag: "Configurações", body: { value: {} } }), parameters: [{ name: "key", in: "path", required: true, schema: s }] } },
    "/api/privacy/requests": { get: op({ summary: "Solicitações de titulares", tag: "Privacidade" }), post: op({ summary: "Registrar solicitação de titular", tag: "Privacidade" }) },
    "/api/privacy/subjects": { get: op({ summary: "Localizar titular (usuário ou pessoa)", tag: "Privacidade", query: { q: s } }) },
    "/api/privacy/requests/{id}/export": { get: op({ summary: "Exportar dados do titular (JSON)", tag: "Privacidade", params: ["id"] }) },
    "/api/privacy/requests/{id}/close": { post: op({ summary: "Encerrar solicitação (opcionalmente anonimizar)", tag: "Privacidade", params: ["id"] }) },
    "/api/reports/{type}": { get: { ...op({ summary: "Gerar relatório PDF do catálogo", tag: "Relatórios", query: { workId: u, unitId: u, from: s, to: s, action: s } }), parameters: [{ name: "type", in: "path", required: true, schema: s }] } },
    "/api/approval-policies": { get: op({ summary: "Fluxos e alçadas de aprovação", tag: "Aprovações" }) },
    "/api/approval-policies/{kind}": { patch: { ...op({ summary: "Alterar fluxo de aprovação", tag: "Aprovações", body: { stepsRequired: { type: "integer" }, requireSegregation: b } }), parameters: [{ name: "kind", in: "path", required: true, schema: s }] } },
  },
} as const;
