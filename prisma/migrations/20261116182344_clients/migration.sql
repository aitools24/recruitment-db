-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "clientId" TEXT;

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "location" TEXT,
    "website" TEXT,
    "gstin" TEXT,
    "contactName" TEXT,
    "contactTitle" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "feePercent" DOUBLE PRECISION,
    "billingAfterDays" INTEGER,
    "guaranteeDays" INTEGER,
    "agreementStart" DATE,
    "agreementEnd" DATE,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Client_tenantId_name_key" ON "Client"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Candidate_tenantId_clientId_idx" ON "Candidate"("tenantId", "clientId");

-- Backfill: one Client per distinct client name already typed on pipeline candidates, then link them.
INSERT INTO "Client" ("id", "tenantId", "name", "updatedAt")
SELECT 'c' || substr(md5(random()::text || t."tenantId" || t.name), 1, 24), t."tenantId", t.name, now()
  FROM (SELECT DISTINCT "tenantId", btrim("clientName") AS name FROM "Candidate" WHERE coalesce(btrim("clientName"), '') <> '') t
ON CONFLICT ("tenantId", "name") DO NOTHING;

UPDATE "Candidate" c SET "clientId" = cl.id
  FROM "Client" cl
 WHERE cl."tenantId" = c."tenantId" AND cl.name = btrim(c."clientName");
