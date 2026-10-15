-- CreateEnum
CREATE TYPE "MilestoneKind" AS ENUM ('APROVACAO', 'ENTREGA', 'MARCO');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('RASCUNHO', 'EM_APROVACAO', 'APROVADA', 'REJEITADA', 'DEVOLVIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('RASCUNHO', 'EM_APROVACAO', 'APROVADO', 'REJEITADO', 'SUBSTITUIDO');

-- CreateEnum
CREATE TYPE "BudgetCategory" AS ENUM ('MATERIAIS', 'SERVICOS', 'MAO_DE_OBRA', 'LOCACOES', 'OUTRAS');

-- CreateEnum
CREATE TYPE "CostKind" AS ENUM ('CONTRATADO', 'COMPROMETIDO', 'PAGO');

-- CreateEnum
CREATE TYPE "CostStatus" AS ENUM ('REGISTRADO', 'AGUARDANDO_APROVACAO', 'APROVADO', 'REJEITADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "PrivacySubject" AS ENUM ('USUARIO', 'PESSOA');

-- CreateEnum
CREATE TYPE "PrivacyRequestKind" AS ENUM ('ACESSO', 'CORRECAO', 'ANONIMIZACAO', 'ELIMINACAO', 'OPOSICAO', 'INFORMACAO');

-- CreateEnum
CREATE TYPE "PrivacyRequestStatus" AS ENUM ('ABERTA', 'ATENDIDA', 'RECUSADA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApprovalKind" ADD VALUE 'MUDANCA_ESCOPO';
ALTER TYPE "ApprovalKind" ADD VALUE 'ORCAMENTO';
ALTER TYPE "ApprovalKind" ADD VALUE 'MEDICAO';
ALTER TYPE "ApprovalKind" ADD VALUE 'DESPESA';

-- AlterTable
ALTER TABLE "approval" ADD COLUMN     "amount" DECIMAL(14,2),
ADD COLUMN     "subject_id" UUID;

-- AlterTable
ALTER TABLE "work_stage" ADD COLUMN     "delay_reason" VARCHAR(1000),
ADD COLUMN     "depends_on_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "work_milestone" (
    "id" UUID NOT NULL,
    "work_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "kind" "MilestoneKind" NOT NULL DEFAULT 'MARCO',
    "planned_date" DATE NOT NULL,
    "actual_date" DATE,
    "notes" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "work_milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_baseline" (
    "id" UUID NOT NULL,
    "work_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_baseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_diary_entry" (
    "id" UUID NOT NULL,
    "work_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "weather" VARCHAR(120),
    "workforce" INTEGER,
    "activities" VARCHAR(4000) NOT NULL,
    "occurrences" VARCHAR(4000),
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_diary_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scope_change" (
    "id" UUID NOT NULL,
    "work_id" UUID NOT NULL,
    "proposed_scope" VARCHAR(4000) NOT NULL,
    "proposed_justification" VARCHAR(4000) NOT NULL,
    "reason" VARCHAR(2000) NOT NULL,
    "previous_scope" VARCHAR(4000) NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'EM_APROVACAO',
    "requester_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ(3),

    CONSTRAINT "scope_change_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget" (
    "id" UUID NOT NULL,
    "work_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "BudgetStatus" NOT NULL DEFAULT 'RASCUNHO',
    "reason" VARCHAR(1000) NOT NULL,
    "contract_id" UUID,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_by_id" UUID NOT NULL,
    "submitted_by_id" UUID,
    "submitted_at" TIMESTAMPTZ(3),
    "approved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_line" (
    "id" UUID NOT NULL,
    "budget_id" UUID NOT NULL,
    "line_key" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "category" "BudgetCategory" NOT NULL,
    "description" VARCHAR(300) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit_price" DECIMAL(14,2) NOT NULL,
    "company_id" UUID,

    CONSTRAINT "budget_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_entry" (
    "id" UUID NOT NULL,
    "work_id" UUID NOT NULL,
    "unit_path" VARCHAR(1000) NOT NULL,
    "line_key" UUID,
    "category" "BudgetCategory" NOT NULL,
    "kind" "CostKind" NOT NULL,
    "status" "CostStatus" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" DATE NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "company_id" UUID,
    "contract_id" UUID,
    "document_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurement" (
    "id" UUID NOT NULL,
    "work_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "contract_id" UUID,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'RASCUNHO',
    "notes" VARCHAR(2000),
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "measurement_item" (
    "id" UUID NOT NULL,
    "measurement_id" UUID NOT NULL,
    "line_key" UUID NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "notes" VARCHAR(500),

    CONSTRAINT "measurement_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_tier" (
    "id" UUID NOT NULL,
    "kind" "ApprovalKind" NOT NULL,
    "up_to_amount" DECIMAL(14,2),
    "steps_required" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_tier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_setting" (
    "key" VARCHAR(80) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "system_setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "privacy_request" (
    "id" UUID NOT NULL,
    "subject_type" "PrivacySubject" NOT NULL,
    "subject_id" UUID NOT NULL,
    "kind" "PrivacyRequestKind" NOT NULL,
    "status" "PrivacyRequestStatus" NOT NULL DEFAULT 'ABERTA',
    "channel" VARCHAR(120) NOT NULL,
    "details" VARCHAR(2000) NOT NULL,
    "resolution" VARCHAR(2000),
    "due_date" DATE NOT NULL,
    "created_by_id" UUID NOT NULL,
    "handled_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(3),

    CONSTRAINT "privacy_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_milestone_work_id_planned_date_idx" ON "work_milestone"("work_id", "planned_date");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_baseline_work_id_version_key" ON "schedule_baseline"("work_id", "version");

-- CreateIndex
CREATE INDEX "work_diary_entry_work_id_date_idx" ON "work_diary_entry"("work_id", "date");

-- CreateIndex
CREATE INDEX "scope_change_work_id_idx" ON "scope_change"("work_id");

-- CreateIndex
CREATE UNIQUE INDEX "budget_work_id_version_key" ON "budget"("work_id", "version");

-- CreateIndex
CREATE INDEX "budget_line_budget_id_idx" ON "budget_line"("budget_id");

-- CreateIndex
CREATE INDEX "budget_line_line_key_idx" ON "budget_line"("line_key");

-- CreateIndex
CREATE INDEX "cost_entry_work_id_kind_idx" ON "cost_entry"("work_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "measurement_work_id_number_key" ON "measurement"("work_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "measurement_item_measurement_id_line_key_key" ON "measurement_item"("measurement_id", "line_key");

-- CreateIndex
CREATE INDEX "approval_tier_kind_idx" ON "approval_tier"("kind");

-- CreateIndex
CREATE INDEX "privacy_request_status_idx" ON "privacy_request"("status");

-- CreateIndex
CREATE INDEX "approval_subject_id_idx" ON "approval"("subject_id");

-- AddForeignKey
ALTER TABLE "work_milestone" ADD CONSTRAINT "work_milestone_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_baseline" ADD CONSTRAINT "schedule_baseline_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_diary_entry" ADD CONSTRAINT "work_diary_entry_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scope_change" ADD CONSTRAINT "scope_change_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget" ADD CONSTRAINT "budget_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_line" ADD CONSTRAINT "budget_line_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_entry" ADD CONSTRAINT "cost_entry_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurement" ADD CONSTRAINT "measurement_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "measurement_item" ADD CONSTRAINT "measurement_item_measurement_id_fkey" FOREIGN KEY ("measurement_id") REFERENCES "measurement"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Integridade adicional
ALTER TABLE "budget_line" ADD CONSTRAINT "budget_line_values" CHECK ("quantity" >= 0 AND "unit_price" >= 0);
ALTER TABLE "cost_entry" ADD CONSTRAINT "cost_entry_amount" CHECK ("amount" > 0);
ALTER TABLE "measurement_item" ADD CONSTRAINT "measurement_item_values" CHECK ("quantity" >= 0 AND "amount" >= 0);
ALTER TABLE "measurement" ADD CONSTRAINT "measurement_period" CHECK ("period_end" >= "period_start");
ALTER TABLE "approval_tier" ADD CONSTRAINT "approval_tier_steps" CHECK ("steps_required" BETWEEN 1 AND 5);
