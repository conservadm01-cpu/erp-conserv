-- CreateEnum
CREATE TYPE "PersonCategory" AS ENUM ('PROFISSIONAL', 'EMPREGADO', 'VOLUNTARIO', 'OUTRO');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ATIVO', 'INATIVO');

-- CreateEnum
CREATE TYPE "CredentialKind" AS ENUM ('REGISTRO_CONSELHO', 'QUALIFICACAO', 'HABILITACAO', 'CERTIFICADO', 'TREINAMENTO', 'INTEGRACAO_SEGURANCA');

-- CreateEnum
CREATE TYPE "CompanyVerification" AS ENUM ('NAO_VERIFICADA', 'VERIFICADA_MANUALMENTE');

-- CreateEnum
CREATE TYPE "ContractKind" AS ENUM ('CONTRATO', 'ADITIVO', 'ORDEM_SERVICO');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('RASCUNHO', 'VIGENTE', 'ENCERRADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "EpiMovementType" AS ENUM ('ENTRADA', 'ENTREGA', 'DEVOLUCAO', 'BAIXA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "ReceiptConfirmation" AS ENUM ('TERMO_FISICO_ARQUIVADO', 'CONFIRMACAO_PRESENCIAL_REGISTRADA', 'PENDENTE');

-- CreateEnum
CREATE TYPE "EquipmentKind" AS ENUM ('FERRAMENTA', 'EQUIPAMENTO_COLETIVO', 'MAQUINA', 'EPI_DURAVEL');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('DISPONIVEL', 'EM_USO', 'EM_MANUTENCAO', 'INTERDITADO', 'BAIXADO');

-- CreateEnum
CREATE TYPE "EquipmentLogType" AS ENUM ('INSPECAO', 'MANUTENCAO', 'DEFEITO');

-- CreateEnum
CREATE TYPE "InspectionStatus" AS ENUM ('PLANEJADA', 'EM_ANDAMENTO', 'CONCLUIDA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "InspectionResult" AS ENUM ('PENDENTE', 'CONFORME', 'NAO_CONFORME', 'NAO_APLICAVEL');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('ABERTO', 'CONTROLADO', 'ENCERRADO');

-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('INCIDENTE', 'QUASE_ACIDENTE', 'ACIDENTE');

-- CreateEnum
CREATE TYPE "CorrectiveActionStatus" AS ENUM ('ABERTA', 'EM_ANDAMENTO', 'AGUARDANDO_VALIDACAO', 'ENCERRADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "NotificationSeverity" AS ENUM ('INFO', 'ALERTA', 'CRITICO');

-- AlterTable
ALTER TABLE "document" ADD COLUMN     "company_id" UUID,
ADD COLUMN     "equipment_id" UUID,
ADD COLUMN     "person_id" UUID,
ALTER COLUMN "work_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "person" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "category" "PersonCategory" NOT NULL,
    "bond_description" VARCHAR(300),
    "legal_review_note" VARCHAR(1000),
    "internal_id" VARCHAR(60),
    "email" VARCHAR(254),
    "phone" VARCHAR(30),
    "job_function" VARCHAR(120),
    "authorized_activities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "company_id" UUID,
    "unit_id" UUID NOT NULL,
    "unit_path" VARCHAR(1000) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ATIVO',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professional_credential" (
    "id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "kind" "CredentialKind" NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "issuer" VARCHAR(200),
    "number" VARCHAR(100),
    "issue_date" DATE,
    "expiry_date" DATE,
    "document_id" UUID,
    "verified_at" TIMESTAMPTZ(3),
    "verified_by_id" UUID,
    "verification_source" VARCHAR(300),
    "status" "RecordStatus" NOT NULL DEFAULT 'ATIVO',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "professional_credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_assignment" (
    "id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "work_id" UUID NOT NULL,
    "role" VARCHAR(120) NOT NULL,
    "activities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "safety_briefing_at" DATE,
    "safety_briefing_note" VARCHAR(1000),
    "status" "RecordStatus" NOT NULL DEFAULT 'ATIVO',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "work_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company" (
    "id" UUID NOT NULL,
    "legal_name" VARCHAR(200) NOT NULL,
    "trade_name" VARCHAR(200),
    "cnpj" CHAR(14) NOT NULL,
    "email" VARCHAR(254),
    "phone" VARCHAR(30),
    "street" VARCHAR(200),
    "number" VARCHAR(20),
    "district" VARCHAR(120),
    "city" VARCHAR(120),
    "state" CHAR(2),
    "postal_code" VARCHAR(9),
    "services" VARCHAR(1000),
    "contract_manager_name" VARCHAR(200),
    "technical_manager_name" VARCHAR(200),
    "verification" "CompanyVerification" NOT NULL DEFAULT 'NAO_VERIFICADA',
    "verification_source" VARCHAR(300),
    "verified_at" TIMESTAMPTZ(3),
    "verified_by_id" UUID,
    "unit_id" UUID NOT NULL,
    "unit_path" VARCHAR(1000) NOT NULL,
    "status" "RecordStatus" NOT NULL DEFAULT 'ATIVO',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contract" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "work_id" UUID,
    "parent_id" UUID,
    "kind" "ContractKind" NOT NULL,
    "number" VARCHAR(60) NOT NULL,
    "object" VARCHAR(2000) NOT NULL,
    "value" DECIMAL(14,2),
    "start_date" DATE,
    "end_date" DATE,
    "status" "ContractStatus" NOT NULL DEFAULT 'RASCUNHO',
    "unit_path" VARCHAR(1000) NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "epi_catalog" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "epi_type" VARCHAR(120) NOT NULL,
    "manufacturer" VARCHAR(200),
    "model" VARCHAR(120),
    "size" VARCHAR(30),
    "ca_number" VARCHAR(30),
    "ca_expiry" DATE,
    "shelf_life_months" INTEGER,
    "min_stock" INTEGER NOT NULL DEFAULT 0,
    "indicated_for" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "RecordStatus" NOT NULL DEFAULT 'ATIVO',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "epi_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "epi_stock_movement" (
    "id" UUID NOT NULL,
    "catalog_id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "unit_path" VARCHAR(1000) NOT NULL,
    "type" "EpiMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lot" VARCHAR(60),
    "expiry_date" DATE,
    "delivery_id" UUID,
    "note" VARCHAR(500),
    "actor_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "epi_stock_movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "epi_delivery" (
    "id" UUID NOT NULL,
    "catalog_id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "work_id" UUID,
    "unit_id" UUID NOT NULL,
    "unit_path" VARCHAR(1000) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lot" VARCHAR(60),
    "delivered_at" DATE NOT NULL,
    "receipt" "ReceiptConfirmation" NOT NULL DEFAULT 'PENDENTE',
    "receipt_note" VARCHAR(500),
    "returned_at" DATE,
    "returned_quantity" INTEGER,
    "return_condition" VARCHAR(300),
    "replaces_id" UUID,
    "replacement_reason" VARCHAR(300),
    "delivered_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "epi_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" UUID NOT NULL,
    "kind" "EquipmentKind" NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "identifier" VARCHAR(80),
    "manufacturer" VARCHAR(200),
    "model" VARCHAR(120),
    "status" "EquipmentStatus" NOT NULL DEFAULT 'DISPONIVEL',
    "unit_id" UUID NOT NULL,
    "unit_path" VARCHAR(1000) NOT NULL,
    "inspection_interval_days" INTEGER,
    "maintenance_interval_days" INTEGER,
    "next_inspection_at" DATE,
    "next_maintenance_at" DATE,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_log" (
    "id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,
    "type" "EquipmentLogType" NOT NULL,
    "date" DATE NOT NULL,
    "approved" BOOLEAN,
    "notes" VARCHAR(2000) NOT NULL,
    "actor_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "criticality_level" (
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "rank" INTEGER NOT NULL,
    "response_days" INTEGER NOT NULL,
    "priority_alert" BOOLEAN NOT NULL DEFAULT false,
    "blocks_progress" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "criticality_level_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "checklist_template" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "work_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "checklist_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_template_item" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "text" VARCHAR(500) NOT NULL,
    "default_criticality" VARCHAR(20) NOT NULL,

    CONSTRAINT "checklist_template_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection" (
    "id" UUID NOT NULL,
    "work_id" UUID NOT NULL,
    "unit_path" VARCHAR(1000) NOT NULL,
    "template_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "planned_date" DATE NOT NULL,
    "performed_at" TIMESTAMPTZ(3),
    "location" VARCHAR(200),
    "inspector_id" UUID NOT NULL,
    "status" "InspectionStatus" NOT NULL DEFAULT 'PLANEJADA',
    "summary" VARCHAR(4000),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_item" (
    "id" UUID NOT NULL,
    "inspection_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "text" VARCHAR(500) NOT NULL,
    "result" "InspectionResult" NOT NULL DEFAULT 'PENDENTE',
    "criticality" VARCHAR(20) NOT NULL,
    "observation" VARCHAR(2000),
    "document_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "inspection_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk" (
    "id" UUID NOT NULL,
    "work_id" UUID NOT NULL,
    "unit_path" VARCHAR(1000) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000),
    "activity" VARCHAR(40),
    "criticality" VARCHAR(20) NOT NULL,
    "controls" VARCHAR(2000),
    "status" "RiskStatus" NOT NULL DEFAULT 'ABERTO',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "risk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident" (
    "id" UUID NOT NULL,
    "work_id" UUID NOT NULL,
    "unit_path" VARCHAR(1000) NOT NULL,
    "type" "IncidentType" NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "location" VARCHAR(200),
    "description" VARCHAR(4000) NOT NULL,
    "immediate_actions" VARCHAR(2000),
    "criticality" VARCHAR(20) NOT NULL,
    "reported_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corrective_action" (
    "id" UUID NOT NULL,
    "work_id" UUID NOT NULL,
    "unit_path" VARCHAR(1000) NOT NULL,
    "inspection_item_id" UUID,
    "risk_id" UUID,
    "incident_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000),
    "criticality" VARCHAR(20) NOT NULL,
    "responsible_name" VARCHAR(200) NOT NULL,
    "responsible_user_id" UUID,
    "due_date" DATE NOT NULL,
    "status" "CorrectiveActionStatus" NOT NULL DEFAULT 'ABERTA',
    "evidence" VARCHAR(4000),
    "evidence_document_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "submitted_by_id" UUID,
    "submitted_at" TIMESTAMPTZ(3),
    "validated_by_id" UUID,
    "validated_at" TIMESTAMPTZ(3),
    "validation_note" VARCHAR(2000),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "corrective_action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" VARCHAR(60) NOT NULL,
    "severity" "NotificationSeverity" NOT NULL DEFAULT 'INFO',
    "title" VARCHAR(200) NOT NULL,
    "body" VARCHAR(1000) NOT NULL,
    "link" VARCHAR(300),
    "dedup_key" VARCHAR(200) NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "emailed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "person_unit_path_idx" ON "person"("unit_path");

-- CreateIndex
CREATE INDEX "person_category_idx" ON "person"("category");

-- CreateIndex
CREATE INDEX "professional_credential_person_id_idx" ON "professional_credential"("person_id");

-- CreateIndex
CREATE INDEX "professional_credential_expiry_date_idx" ON "professional_credential"("expiry_date");

-- CreateIndex
CREATE INDEX "work_assignment_work_id_idx" ON "work_assignment"("work_id");

-- CreateIndex
CREATE INDEX "work_assignment_person_id_idx" ON "work_assignment"("person_id");

-- CreateIndex
CREATE UNIQUE INDEX "company_cnpj_key" ON "company"("cnpj");

-- CreateIndex
CREATE INDEX "company_unit_path_idx" ON "company"("unit_path");

-- CreateIndex
CREATE INDEX "contract_work_id_idx" ON "contract"("work_id");

-- CreateIndex
CREATE UNIQUE INDEX "contract_company_id_number_key" ON "contract"("company_id", "number");

-- CreateIndex
CREATE INDEX "epi_stock_movement_catalog_id_unit_id_idx" ON "epi_stock_movement"("catalog_id", "unit_id");

-- CreateIndex
CREATE INDEX "epi_stock_movement_unit_path_idx" ON "epi_stock_movement"("unit_path");

-- CreateIndex
CREATE INDEX "epi_delivery_person_id_idx" ON "epi_delivery"("person_id");

-- CreateIndex
CREATE INDEX "epi_delivery_work_id_idx" ON "epi_delivery"("work_id");

-- CreateIndex
CREATE INDEX "epi_delivery_unit_path_idx" ON "epi_delivery"("unit_path");

-- CreateIndex
CREATE INDEX "equipment_unit_path_idx" ON "equipment"("unit_path");

-- CreateIndex
CREATE INDEX "equipment_log_equipment_id_date_idx" ON "equipment_log"("equipment_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "criticality_level_rank_key" ON "criticality_level"("rank");

-- CreateIndex
CREATE INDEX "checklist_template_item_template_id_idx" ON "checklist_template_item"("template_id");

-- CreateIndex
CREATE INDEX "inspection_work_id_idx" ON "inspection"("work_id");

-- CreateIndex
CREATE INDEX "inspection_status_planned_date_idx" ON "inspection"("status", "planned_date");

-- CreateIndex
CREATE INDEX "inspection_item_inspection_id_idx" ON "inspection_item"("inspection_id");

-- CreateIndex
CREATE INDEX "risk_work_id_idx" ON "risk"("work_id");

-- CreateIndex
CREATE INDEX "incident_work_id_idx" ON "incident"("work_id");

-- CreateIndex
CREATE INDEX "corrective_action_work_id_status_idx" ON "corrective_action"("work_id", "status");

-- CreateIndex
CREATE INDEX "corrective_action_status_due_date_idx" ON "corrective_action"("status", "due_date");

-- CreateIndex
CREATE INDEX "notification_user_id_read_at_idx" ON "notification"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_user_id_dedup_key_key" ON "notification"("user_id", "dedup_key");

-- CreateIndex
CREATE INDEX "document_person_id_idx" ON "document"("person_id");

-- CreateIndex
CREATE INDEX "document_company_id_idx" ON "document"("company_id");

-- CreateIndex
CREATE INDEX "document_equipment_id_idx" ON "document"("equipment_id");

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person" ADD CONSTRAINT "person_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "person" ADD CONSTRAINT "person_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "organization_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_credential" ADD CONSTRAINT "professional_credential_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "professional_credential" ADD CONSTRAINT "professional_credential_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_assignment" ADD CONSTRAINT "work_assignment_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_assignment" ADD CONSTRAINT "work_assignment_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company" ADD CONSTRAINT "company_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "organization_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract" ADD CONSTRAINT "contract_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epi_stock_movement" ADD CONSTRAINT "epi_stock_movement_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "epi_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epi_stock_movement" ADD CONSTRAINT "epi_stock_movement_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "organization_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epi_delivery" ADD CONSTRAINT "epi_delivery_catalog_id_fkey" FOREIGN KEY ("catalog_id") REFERENCES "epi_catalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epi_delivery" ADD CONSTRAINT "epi_delivery_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "epi_delivery" ADD CONSTRAINT "epi_delivery_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "organization_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_log" ADD CONSTRAINT "equipment_log_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_template_item" ADD CONSTRAINT "checklist_template_item_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "checklist_template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "checklist_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_item" ADD CONSTRAINT "inspection_item_inspection_id_fkey" FOREIGN KEY ("inspection_id") REFERENCES "inspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk" ADD CONSTRAINT "risk_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident" ADD CONSTRAINT "incident_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_action" ADD CONSTRAINT "corrective_action_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_action" ADD CONSTRAINT "corrective_action_inspection_item_id_fkey" FOREIGN KEY ("inspection_item_id") REFERENCES "inspection_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_action" ADD CONSTRAINT "corrective_action_risk_id_fkey" FOREIGN KEY ("risk_id") REFERENCES "risk"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corrective_action" ADD CONSTRAINT "corrective_action_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incident"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Documento tem exatamente um dono.
ALTER TABLE "document" ADD CONSTRAINT "document_single_owner" CHECK (
  (("work_id" IS NOT NULL)::int + ("person_id" IS NOT NULL)::int + ("company_id" IS NOT NULL)::int + ("equipment_id" IS NOT NULL)::int) = 1
);
ALTER TABLE "epi_delivery" ADD CONSTRAINT "epi_delivery_quantity" CHECK ("quantity" > 0);
ALTER TABLE "epi_stock_movement" ADD CONSTRAINT "epi_movement_nonzero" CHECK ("quantity" <> 0);
ALTER TABLE "company" ADD CONSTRAINT "company_cnpj_digits" CHECK ("cnpj" ~ '^[0-9]{14}$');
ALTER TABLE "criticality_level" ADD CONSTRAINT "criticality_response_days" CHECK ("response_days" BETWEEN 0 AND 365);
