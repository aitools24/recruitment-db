-- Immutable helper so array columns can be used in a generated column
CREATE OR REPLACE FUNCTION immutable_array_to_string(text[], text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT coalesce(array_to_string($1, $2), '') $$;

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'RECRUITER', 'VIEWER');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "exportRoles" "Role"[] DEFAULT ARRAY['ADMIN', 'MANAGER']::"Role"[],
    "exportMaxRows" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'RECRUITER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "emailLower" TEXT,
    "phone" TEXT,
    "phoneNormalized" TEXT,
    "altPhone" TEXT,
    "location" TEXT,
    "linkedinUrl" TEXT,
    "currentCompany" TEXT,
    "currentTitle" TEXT,
    "industry" TEXT,
    "functionalArea" TEXT,
    "totalExperience" DOUBLE PRECISION,
    "currentCtc" DOUBLE PRECISION,
    "expectedCtc" DOUBLE PRECISION,
    "noticePeriodDays" INTEGER,
    "highestDegree" TEXT,
    "college" TEXT,
    "education" TEXT,
    "certifications" TEXT,
    "languages" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "customFields" JSONB,
    "resumeText" TEXT,
    "ownerId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resume" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "text" TEXT,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Resume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "candidateId" TEXT,
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "kind" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "Candidate_tenantId_emailLower_idx" ON "Candidate"("tenantId", "emailLower");

-- CreateIndex
CREATE INDEX "Candidate_tenantId_phoneNormalized_idx" ON "Candidate"("tenantId", "phoneNormalized");

-- CreateIndex
CREATE INDEX "Candidate_tenantId_createdAt_idx" ON "Candidate"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Candidate_tenantId_industry_idx" ON "Candidate"("tenantId", "industry");

-- CreateIndex
CREATE INDEX "Resume_tenantId_candidateId_idx" ON "Resume"("tenantId", "candidateId");

-- CreateIndex
CREATE INDEX "Note_tenantId_candidateId_idx" ON "Note"("tenantId", "candidateId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_candidateId_idx" ON "AuditLog"("tenantId", "candidateId");

-- CreateIndex
CREATE INDEX "ImportJob_tenantId_createdAt_idx" ON "ImportJob"("tenantId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Full-text search vector over profile fields + latest resume text
ALTER TABLE "Candidate" ADD COLUMN "searchVector" tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce("fullName", '')), 'A') ||
  setweight(to_tsvector('english',
    coalesce("currentTitle", '') || ' ' || coalesce("currentCompany", '') || ' ' ||
    immutable_array_to_string("skills", ' ') || ' ' || immutable_array_to_string("tags", ' ')), 'A') ||
  setweight(to_tsvector('english',
    coalesce("industry", '') || ' ' || coalesce("functionalArea", '') || ' ' ||
    coalesce("location", '') || ' ' || coalesce("email", '') || ' ' ||
    coalesce("highestDegree", '') || ' ' || coalesce("college", '') || ' ' ||
    coalesce("education", '') || ' ' || coalesce("certifications", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("resumeText", '')), 'D')
) STORED;

CREATE INDEX "Candidate_searchVector_idx" ON "Candidate" USING GIN ("searchVector");
CREATE INDEX "Candidate_skills_idx" ON "Candidate" USING GIN ("skills");
CREATE INDEX "Candidate_tags_idx" ON "Candidate" USING GIN ("tags");
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Candidate_fullName_trgm_idx" ON "Candidate" USING GIN ("fullName" gin_trgm_ops);
