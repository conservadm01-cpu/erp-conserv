-- CreateEnum
CREATE TYPE "HealthExamType" AS ENUM ('ADMISSIONAL', 'PERIODICO', 'RETORNO_TRABALHO', 'MUDANCA_RISCO', 'DEMISSIONAL', 'OUTRO');

-- CreateEnum
CREATE TYPE "HealthFitness" AS ENUM ('APTO', 'INAPTO');

-- CreateEnum
CREATE TYPE "HealthCertificateStatus" AS ENUM ('PENDENTE_CONFERENCIA', 'CONFERIDO', 'INATIVO');

-- CreateEnum
CREATE TYPE "PersonRuleKind" AS ENUM ('CREDENCIAL', 'SAUDE');

-- AlterEnum
ALTER TYPE "CredentialKind" ADD VALUE 'EXPERIENCIA';

-- AlterTable
ALTER TABLE "document" ADD COLUMN     "sensitive" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "person" ADD COLUMN     "user_id" UUID;

-- CreateTable
CREATE TABLE "health_certificate" (
    "id" UUID NOT NULL,
    "person_id" UUID NOT NULL,
    "exam_type" "HealthExamType" NOT NULL,
    "result" "HealthFitness" NOT NULL,
    "fit_for" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "exam_date" DATE NOT NULL,
    "expiry_date" DATE,
    "document_id" UUID,
    "status" "HealthCertificateStatus" NOT NULL DEFAULT 'PENDENTE_CONFERENCIA',
    "checked_by_id" UUID,
    "checked_at" TIMESTAMPTZ(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "health_certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "person_requirement_rule" (
    "id" UUID NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "activity_code" VARCHAR(40) NOT NULL,
    "kind" "PersonRuleKind" NOT NULL,
    "credential_kind" "CredentialKind",
    "credential_name_contains" VARCHAR(100),
    "classification" "RequirementClassification" NOT NULL,
    "legal_basis" VARCHAR(500),
    "source_url" VARCHAR(500),
    "last_reviewed_at" DATE,
    "validated_by_id" UUID,
    "validated_at" TIMESTAMPTZ(3),
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "status" "RequirementRuleStatus" NOT NULL DEFAULT 'PENDENTE_VALIDACAO',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "person_requirement_rule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "health_certificate_person_id_idx" ON "health_certificate"("person_id");

-- CreateIndex
CREATE INDEX "health_certificate_expiry_date_idx" ON "health_certificate"("expiry_date");

-- CreateIndex
CREATE UNIQUE INDEX "person_requirement_rule_code_key" ON "person_requirement_rule"("code");

-- CreateIndex
CREATE UNIQUE INDEX "person_user_id_key" ON "person"("user_id");

-- AddForeignKey
ALTER TABLE "health_certificate" ADD CONSTRAINT "health_certificate_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "health_certificate" ADD CONSTRAINT "health_certificate_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
