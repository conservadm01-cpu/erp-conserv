-- CreateEnum
CREATE TYPE "AgendaEventKind" AS ENUM ('MUTIRAO', 'VISITA_TECNICA', 'ENTREGA_MATERIAL', 'REUNIAO', 'INSPECAO', 'INTEGRACAO_SEGURANCA', 'OUTRO');

-- CreateEnum
CREATE TYPE "AgendaEventStatus" AS ENUM ('AGENDADO', 'REALIZADO', 'CANCELADO');

-- CreateTable
CREATE TABLE "agenda_event" (
    "id" UUID NOT NULL,
    "unit_id" UUID NOT NULL,
    "unit_path" VARCHAR(1000) NOT NULL,
    "work_id" UUID,
    "kind" "AgendaEventKind" NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3),
    "location" VARCHAR(200),
    "notes" VARCHAR(2000),
    "slots" INTEGER,
    "status" "AgendaEventStatus" NOT NULL DEFAULT 'AGENDADO',
    "status_reason" VARCHAR(1000),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "agenda_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agenda_event_unit_path_starts_at_idx" ON "agenda_event"("unit_path", "starts_at");

-- CreateIndex
CREATE INDEX "agenda_event_work_id_idx" ON "agenda_event"("work_id");

-- AddForeignKey
ALTER TABLE "agenda_event" ADD CONSTRAINT "agenda_event_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "organization_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agenda_event" ADD CONSTRAINT "agenda_event_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "work"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Término não pode ser anterior ao início; vagas positivas.
ALTER TABLE "agenda_event" ADD CONSTRAINT "agenda_event_periodo" CHECK ("ends_at" IS NULL OR "ends_at" >= "starts_at");
ALTER TABLE "agenda_event" ADD CONSTRAINT "agenda_event_vagas" CHECK ("slots" IS NULL OR "slots" > 0);
