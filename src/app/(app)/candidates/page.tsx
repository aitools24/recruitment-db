import { Suspense } from "react";
import { requirePage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { INDUSTRIES, SOURCES, STATUSES } from "@/lib/normalize";
import CandidateSearch from "@/components/CandidateSearch";

export default async function CandidatesPage({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const s = await requirePage("viewCandidates");
  const [tenant, users, industries] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: s.tenantId } }),
    prisma.user.findMany({ where: { tenantId: s.tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.candidate.findMany({ where: { tenantId: s.tenantId, industry: { not: null } }, distinct: ["industry"], select: { industry: true } }),
  ]);
  const industryOptions = [...new Set([...INDUSTRIES, ...industries.map((i) => i.industry!)])].sort();
  return (
    <>
      {(await searchParams).denied && <p className="mb-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">You don&apos;t have access to that page.</p>}
      <Suspense>
        <CandidateSearch
          users={users}
          industries={industryOptions}
          sources={SOURCES}
          statuses={STATUSES}
          canExport={tenant.exportRoles.includes(s.role)}
          exportMax={tenant.exportMaxRows}
          canEdit={can(s.role, "editCandidates")}
        />
      </Suspense>
    </>
  );
}
