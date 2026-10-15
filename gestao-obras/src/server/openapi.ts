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
    version: "0.1.0",
    description:
      "API da Fase 1 (fundação). Autenticação por cookie de sessão httpOnly. Requisições de alteração devem enviar o cabeçalho Origin da própria aplicação.",
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
    "/api/dashboard": { get: op({ summary: "Indicadores do painel", tag: "Painel" }) },
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
    "/api/users/{id}/scopes": { post: op({ summary: "Conceder papel em unidade", tag: "Usuários", params: ["id"], body: { roleId: u, unitId: u, includeDescendants: b } }) },
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
  },
} as const;
