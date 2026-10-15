-- CreateEnum
CREATE TYPE "WorkStatus" AS ENUM ('RASCUNHO', 'SOLICITADA', 'EM_TRIAGEM', 'EM_APROVACAO', 'APROVADA', 'EM_EXECUCAO', 'SUSPENSA', 'EM_VISTORIA', 'CONCLUIDA', 'REJEITADA', 'ARQUIVADA');

-- CreateEnum
CREATE TYPE "WorkPriority" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE');

-- CreateEnum
CREATE TYPE "ExecutionMode" AS ENUM ('VOLUNTARIOS', 'EMPRESA_CONTRATADA', 'MISTA');

-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('NAO_INICIADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('ENVIADO', 'EM_REVISAO', 'APROVADO', 'REJEITADO', 'VENCIDO', 'SUBSTITUIDO');

-- CreateEnum
CREATE TYPE "RequirementClassification" AS ENUM ('LEGAL_OBRIGATORIO', 'LEGAL_CONDICIONAL', 'CONTRATUAL', 'INSTITUCIONAL_APROVADO', 'BOA_PRATICA', 'INFORMATIVO');

-- CreateEnum
CREATE TYPE "RequirementRuleStatus" AS ENUM ('PENDENTE_VALIDACAO', 'VALIDADA', 'INATIVA');

-- CreateEnum
CREATE TYPE "WorkCheckpoint" AS ENUM ('TRIAGEM', 'APROVACAO', 'INICIO_EXECUCAO', 'VISTORIA', 'ENCERRAMENTO');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('PENDENTE', 'ATENDIDO', 'NAO_ATENDIDO', 'DISPENSADO_JUSTIFICADO', 'NAO_APLICAVEL');

-- CreateEnum
CREATE TYPE "ApprovalKind" AS ENUM ('SOLICITACAO_OBRA', 'ENCERRAMENTO_OBRA');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA', 'DEVOLVIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('APROVAR', 'REJEITAR', 'DEVOLVER');

-- DropIndex
DROP INDEX "user_scope_user_id_role_id_unit_id_key";

-- AlterTable
ALTER TABLE "user_scope" ADD COLUMN     "work_id" UUID;

-- CreateTable
CREATE TABLE "work_type" (
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_type_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "activity_type" (
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_type_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "work_code_sequence" (
    "year" INTEGER NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "work_code_sequence_pkey" PRIMARY KEY ("year")
);

-- CreateTable
CREATE TABLE "work" (
    "id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "unit_id" UUID NOT NULL,
    "unit_path" VARCHAR(1000) NOT NULL,
    "type_code" VARCHAR(40) NOT NULL,
    "activities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "WorkStatus" NOT NULL DEFAULT 'RASCUNHO',
    "priority" "WorkPriority" NOT NULL DEFAULT 'MEDIA',
    "execution_mode" "ExecutionMode" NOT NULL DEFAULT 'VOLUNTARIOS',
    "scope" VARCHAR(4000) NOT NULL,
    "justification" VARCHAR(4000) NOT NULL,
    "street" VARCHAR(200),
    "number" VARCHAR(20),
    "district" VARCHAR(120),
    "city" VARCHAR(120),
    "state" CHAR(2),
    "postal_code" VARCHAR(9),
    "planned_start" DATE,
    "planned_end" DATE,
    "responsible_name" VARCHAR(200),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID,

    CONSTRAINT "work_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_status_change" (
    "id" UUID NOT NULL,
    "work_id" UUID NOT NULL,
    "from_status" "WorkStatus",
    "to_status" "WorkStatus" NOT NULL,
    "reason" VARCHAR(2000),
    "actor_id" UUID NOT NULL,
    "approval_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_status_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_stage" (
    "id" UUID NOT NULL,
    "work_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "StageStatus" NOT NULL DEFAULT 'NAO_INICIADA',
    "planned_start" DATE,
    "planned_end" DATE,
    "actual_start" DATE,
    "actual_end" DATE,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "responsible_name" VARCHAR(200),
    "notes" VARCHAR(2000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "work_stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_category" (
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "requires_expiry" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_category_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "document" (
    "id" UUID NOT NULL,
    "work_id" UUID NOT NULL,
    "unit_path" VARCHAR(1000) NOT NULL,
    "category_code" VARCHAR(40) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "issuer" VARCHAR(200),
    "document_number" VARCHAR(100),
    "issue_date" DATE,
    "expiry_date" DATE,
    "status" "DocumentStatus" NOT NULL DEFAULT 'ENVIADO',
    "reviewer_note" VARCHAR(2000),
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_version" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "storage_key" VARCHAR(300) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "uploaded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "superseded_at" TIMESTAMPTZ(3),
    "change_note" VARCHAR(500),

    CONSTRAINT "document_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_rule" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000),
    "work_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "activities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "execution_modes" "ExecutionMode"[] DEFAULT ARRAY[]::"ExecutionMode"[],
    "applicability_note" VARCHAR(2000),
    "evidence" VARCHAR(500) NOT NULL,
    "document_category_code" VARCHAR(40),
    "classification" "RequirementClassification" NOT NULL,
    "legal_basis" VARCHAR(500),
    "source_url" VARCHAR(500),
    "norm_version" VARCHAR(100),
    "last_reviewed_at" DATE,
    "validated_by_id" UUID,
    "validated_at" TIMESTAMPTZ(3),
    "next_review_at" DATE,
    "checkpoint" "WorkCheckpoint" NOT NULL,
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "status" "RequirementRuleStatus" NOT NULL DEFAULT 'PENDENTE_VALIDACAO',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "requirement_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_evaluation" (
    "id" UUID NOT NULL,
    "work_id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'PENDENTE',
    "document_id" UUID,
    "justification" VARCHAR(2000),
    "evaluated_by_id" UUID,
    "evaluated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "requirement_evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_policy" (
    "kind" "ApprovalKind" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "steps_required" INTEGER NOT NULL DEFAULT 1,
    "require_segregation" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "approval_policy_pkey" PRIMARY KEY ("kind")
);

-- CreateTable
CREATE TABLE "approval" (
    "id" UUID NOT NULL,
    "kind" "ApprovalKind" NOT NULL,
    "work_id" UUID NOT NULL,
    "unit_path" VARCHAR(1000) NOT NULL,
    "subject_version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDENTE',
    "steps_required" INTEGER NOT NULL,
    "require_segregation" BOOLEAN NOT NULL,
    "requester_id" UUID NOT NULL,
    "request_note" VARCHAR(2000),
    "decided_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_step" (
    "id" UUID NOT NULL,
    "approval_id" UUID NOT NULL,
    "step_no" INTEGER NOT NULL,
    "approver_id" UUID NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "opinion" VARCHAR(4000) NOT NULL,
    "consulted_document_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "decided_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_step_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "work_code_key" ON "work"("code");

-- CreateIndex
CREATE INDEX "work_unit_path_idx" ON "work"("unit_path");

-- CreateIndex
CREATE INDEX "work_status_idx" ON "work"("status");

-- CreateIndex
CREATE INDEX "work_status_change_work_id_created_at_idx" ON "work_status_change"("work_id", "created_at");

-- CreateIndex
CREATE INDEX "work_stage_work_id_sort_order_idx" ON "work_stage"("work_id", "sort_order");

-- CreateIndex
CREATE INDEX "document_work_id_idx" ON "document"("work_id");

-- CreateIndex
CREATE INDEX "document_unit_path_idx" ON "document"("unit_path");

-- CreateIndex
CREATE INDEX "document_status_expiry_date_idx" ON "document"("status", "expiry_date");

-- CreateIndex
CREATE UNIQUE INDEX "document_version_storage_key_key" ON "document_version"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "document_version_document_id_version_no_key" ON "document_version"("document_id", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_rule_code_key" ON "requirement_rule"("code");

-- CreateIndex
CREATE UNIQUE INDEX "requirement_evaluation_work_id_rule_id_key" ON "requirement_evaluation"("work_id", "rule_id");

-- CreateIndex
CREATE INDEX "approval_status_unit_path_idx" ON "approval"("status", "unit_path");

-- CreateIndex
CREATE INDEX "approval_work_id_idx" ON "approval"("work_id");

-- CreateIndex
CREATE UNIQUE INDEX "approval_step_approval_id_step_no_key" ON "approval_step"("approval_id", "step_no");

-- CreateIndex
CREATE UNIQUE INDEX "approval_step_approval_id_approver_id_key" ON "approval_step"("approval_id", "approver_id");

-- CreateIndex
CREATE INDEX "user_scope_work_id_idx" ON "user_scope"("work_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_scope_user_id_role_id_unit_id_work_id_key" ON "user_scope"("user_id", "role_id", "unit_id", "work_id") NULLS NOT DISTINCT;

-- AddForeignKey
ALTER TABLE "user_scope" ADD CONSTRAINT "user_scope_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work" ADD CONSTRAINT "work_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "organization_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work" ADD CONSTRAINT "work_type_code_fkey" FOREIGN KEY ("type_code") REFERENCES "work_type"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_status_change" ADD CONSTRAINT "work_status_change_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_stage" ADD CONSTRAINT "work_stage_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_category_code_fkey" FOREIGN KEY ("category_code") REFERENCES "document_category"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_version" ADD CONSTRAINT "document_version_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_evaluation" ADD CONSTRAINT "requirement_evaluation_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_evaluation" ADD CONSTRAINT "requirement_evaluation_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "requirement_rule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requirement_evaluation" ADD CONSTRAINT "requirement_evaluation_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval" ADD CONSTRAINT "approval_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_step" ADD CONSTRAINT "approval_step_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "approval"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Integridade adicional
ALTER TABLE "work_stage" ADD CONSTRAINT "work_stage_progress_range" CHECK ("progress" BETWEEN 0 AND 100);
ALTER TABLE "work_stage" ADD CONSTRAINT "work_stage_planned_dates" CHECK ("planned_end" IS NULL OR "planned_start" IS NULL OR "planned_end" >= "planned_start");
ALTER TABLE "work" ADD CONSTRAINT "work_planned_dates" CHECK ("planned_end" IS NULL OR "planned_start" IS NULL OR "planned_end" >= "planned_start");
ALTER TABLE "approval_policy" ADD CONSTRAINT "approval_policy_steps" CHECK ("steps_required" BETWEEN 1 AND 5);
ALTER TABLE "document_version" ADD CONSTRAINT "document_version_size" CHECK ("size_bytes" > 0);
