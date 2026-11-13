import { notFound } from "next/navigation";
import { requirePage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formOptions } from "@/lib/form-options";
import CandidateForm from "@/components/CandidateForm";

export default async function EditCandidate({ params }: { params: Promise<{ id: string }> }) {
  const s = await requirePage("editCandidates");
  const c = await prisma.candidate.findFirst({
    where: { id: (await params).id, tenantId: s.tenantId },
    omit: { resumeText: true, customFields: true },
  });
  if (!c) notFound();
  const { createdAt: _a, updatedAt: _b, ...initial } = c;
  void _a; void _b;
  return (
    <div className="max-w-5xl">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight text-slate-100">Edit {c.fullName}</h1>
      <CandidateForm initial={initial} {...await formOptions(s.tenantId)} ownerDefault={s.userId} />
    </div>
  );
}
