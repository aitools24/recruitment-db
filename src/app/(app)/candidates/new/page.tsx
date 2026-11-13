import { requirePage } from "@/lib/auth";
import { formOptions } from "@/lib/form-options";
import CandidateForm from "@/components/CandidateForm";

export default async function NewCandidate() {
  const s = await requirePage("editCandidates");
  return (
    <div className="max-w-5xl">
      <h1 className="mb-4 text-xl font-semibold">Add candidate</h1>
      <CandidateForm {...await formOptions(s.tenantId)} ownerDefault={s.userId} />
    </div>
  );
}
