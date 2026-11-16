-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "billedOn" DATE,
ADD COLUMN     "billingAmount" DOUBLE PRECISION,
ADD COLUMN     "clientName" TEXT,
ADD COLUMN     "interviewAt" TIMESTAMP(3),
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "joiningDate" DATE,
ADD COLUMN     "offerCtc" DOUBLE PRECISION,
ADD COLUMN     "stage" TEXT,
ADD COLUMN     "stageUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "billingAfterDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "guaranteeDays" INTEGER NOT NULL DEFAULT 90;

-- CreateTable
CREATE TABLE "StageEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "fromStage" TEXT,
    "toStage" TEXT,
    "note" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StageEvent_tenantId_candidateId_idx" ON "StageEvent"("tenantId", "candidateId");

-- CreateIndex
CREATE INDEX "StageEvent_tenantId_createdAt_idx" ON "StageEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Candidate_tenantId_stage_idx" ON "Candidate"("tenantId", "stage");

-- AddForeignKey
ALTER TABLE "StageEvent" ADD CONSTRAINT "StageEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageEvent" ADD CONSTRAINT "StageEvent_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageEvent" ADD CONSTRAINT "StageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
