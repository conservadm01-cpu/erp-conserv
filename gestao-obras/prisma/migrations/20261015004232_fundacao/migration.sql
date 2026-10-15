-- CreateEnum
CREATE TYPE "OrgUnitStatus" AS ENUM ('ATIVA', 'INATIVA');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ATIVO', 'BLOQUEADO', 'INATIVO');

-- CreateEnum
CREATE TYPE "AuditResult" AS ENUM ('SUCESSO', 'FALHA', 'NEGADO');

-- CreateTable
CREATE TABLE "org_unit_type" (
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "is_root" BOOLEAN NOT NULL DEFAULT false,
    "allowed_parent_codes" TEXT[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "org_unit_type_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "organization_unit" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "type_code" VARCHAR(40) NOT NULL,
    "parent_id" UUID,
    "path" VARCHAR(1000) NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "status" "OrgUnitStatus" NOT NULL DEFAULT 'ATIVA',
    "street" VARCHAR(200),
    "number" VARCHAR(20),
    "complement" VARCHAR(100),
    "district" VARCHAR(120),
    "city" VARCHAR(120),
    "state" CHAR(2),
    "postal_code" VARCHAR(9),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,

    CONSTRAINT "organization_unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_unit_contact" (
    "id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "role" VARCHAR(120),
    "email" VARCHAR(254),
    "phone" VARCHAR(30),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "org_unit_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_user" (
    "id" UUID NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "password_hash" VARCHAR(100) NOT NULL,
    "password_changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "status" "UserStatus" NOT NULL DEFAULT 'ATIVO',
    "home_unit_id" UUID NOT NULL,
    "mfa_secret_enc" VARCHAR(500),
    "mfa_enabled_at" TIMESTAMPTZ(3),
    "mfa_last_used_step" BIGINT,
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID,
    "updated_by_id" UUID,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission" (
    "code" VARCHAR(80) NOT NULL,
    "module" VARCHAR(40) NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "role" (
    "id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "requires_mfa" BOOLEAN NOT NULL DEFAULT false,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permission" (
    "role_id" UUID NOT NULL,
    "permission_code" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("role_id","permission_code")
);

-- CreateTable
CREATE TABLE "user_scope" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "include_descendants" BOOLEAN NOT NULL DEFAULT true,
    "granted_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_scope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idle_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "mfa_verified_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(400),

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempt" (
    "id" UUID NOT NULL,
    "identifier" VARCHAR(254) NOT NULL,
    "ip" VARCHAR(64),
    "success" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mfa_recovery_code" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "code_hash" CHAR(64) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mfa_recovery_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_token" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_event" (
    "id" UUID NOT NULL,
    "seq" BIGSERIAL NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_user_id" UUID,
    "actor_label" VARCHAR(254),
    "action" VARCHAR(80) NOT NULL,
    "object_type" VARCHAR(60),
    "object_id" VARCHAR(80),
    "unit_path" VARCHAR(1000),
    "result" "AuditResult" NOT NULL,
    "correlation_id" VARCHAR(64) NOT NULL,
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(400),
    "metadata" JSONB,
    "prev_hash" CHAR(64) NOT NULL,
    "hash" CHAR(64) NOT NULL,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_unit_code_key" ON "organization_unit"("code");

-- CreateIndex
CREATE UNIQUE INDEX "organization_unit_path_key" ON "organization_unit"("path");

-- CreateIndex
CREATE INDEX "organization_unit_parent_id_idx" ON "organization_unit"("parent_id");

-- CreateIndex
CREATE INDEX "organization_unit_type_code_idx" ON "organization_unit"("type_code");

-- CreateIndex
CREATE INDEX "org_unit_contact_unit_id_idx" ON "org_unit_contact"("unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user"("email");

-- CreateIndex
CREATE INDEX "app_user_home_unit_id_idx" ON "app_user"("home_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_code_key" ON "role"("code");

-- CreateIndex
CREATE INDEX "user_scope_unit_id_idx" ON "user_scope"("unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_scope_user_id_role_id_unit_id_key" ON "user_scope"("user_id", "role_id", "unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_hash_key" ON "session"("token_hash");

-- CreateIndex
CREATE INDEX "session_user_id_idx" ON "session"("user_id");

-- CreateIndex
CREATE INDEX "login_attempt_identifier_created_at_idx" ON "login_attempt"("identifier", "created_at");

-- CreateIndex
CREATE INDEX "login_attempt_ip_created_at_idx" ON "login_attempt"("ip", "created_at");

-- CreateIndex
CREATE INDEX "mfa_recovery_code_user_id_idx" ON "mfa_recovery_code"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_token_token_hash_key" ON "password_reset_token"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_token_user_id_idx" ON "password_reset_token"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_event_seq_key" ON "audit_event"("seq");

-- CreateIndex
CREATE INDEX "audit_event_occurred_at_idx" ON "audit_event"("occurred_at");

-- CreateIndex
CREATE INDEX "audit_event_actor_user_id_idx" ON "audit_event"("actor_user_id");

-- CreateIndex
CREATE INDEX "audit_event_action_idx" ON "audit_event"("action");

-- CreateIndex
CREATE INDEX "audit_event_object_type_object_id_idx" ON "audit_event"("object_type", "object_id");

-- AddForeignKey
ALTER TABLE "organization_unit" ADD CONSTRAINT "organization_unit_type_code_fkey" FOREIGN KEY ("type_code") REFERENCES "org_unit_type"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_unit" ADD CONSTRAINT "organization_unit_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "organization_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "org_unit_contact" ADD CONSTRAINT "org_unit_contact_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "organization_unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_home_unit_id_fkey" FOREIGN KEY ("home_unit_id") REFERENCES "organization_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_code_fkey" FOREIGN KEY ("permission_code") REFERENCES "permission"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_scope" ADD CONSTRAINT "user_scope_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_scope" ADD CONSTRAINT "user_scope_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_scope" ADD CONSTRAINT "user_scope_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "organization_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_scope" ADD CONSTRAINT "user_scope_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mfa_recovery_code" ADD CONSTRAINT "mfa_recovery_code_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_token" ADD CONSTRAINT "password_reset_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Proteção da trilha de auditoria: somente INSERT é permitido.
-- Qualquer UPDATE, DELETE ou TRUNCATE gera erro, inclusive vindo da aplicação.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit_event_block_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_event é somente inclusão (operação % bloqueada)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_event_no_update
  BEFORE UPDATE OR DELETE ON "audit_event"
  FOR EACH ROW EXECUTE FUNCTION audit_event_block_changes();

CREATE TRIGGER audit_event_no_truncate
  BEFORE TRUNCATE ON "audit_event"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_event_block_changes();

-- Um único tipo raiz e coerência do caminho materializado.
CREATE UNIQUE INDEX "org_unit_type_single_root" ON "org_unit_type" ("is_root") WHERE "is_root";
ALTER TABLE "organization_unit"
  ADD CONSTRAINT "organization_unit_path_format" CHECK ("path" LIKE '/%/' AND "depth" >= 0);
