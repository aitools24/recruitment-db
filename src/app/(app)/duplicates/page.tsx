import { requirePage } from "@/lib/auth";
import { duplicateGroups } from "@/lib/candidates";
import { can } from "@/lib/permissions";
import { formatCtc, formatExp } from "@/lib/normalize";
import DuplicateGroup from "@/components/DuplicateGroup";

export default async function DuplicatesPage() {
  const s = await requirePage("viewCandidates");
  const groups = await duplicateGroups(s.tenantId);
  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Duplicates</h1>
        <p className="text-sm text-slate-300">Profiles that share an email address or phone number. Merging keeps the profile you choose, fills its blank fields from the others, combines skills, tags, resumes, notes and history, and then removes the extra copies.</p>
      </div>
      {!groups.length && <div className="card p-8 text-center text-slate-400">No duplicates found. 🎉</div>}
      {groups.map((g) => (
        <DuplicateGroup
          key={g.kind + g.key}
          kind={g.kind}
          matchValue={g.key}
          canMerge={can(s.role, "mergeDuplicates")}
          candidates={g.candidates.map((c) => ({
            id: c.id, fullName: c.fullName, email: c.email, phone: c.phone,
            role: [c.currentTitle, c.currentCompany].filter(Boolean).join(" at "),
            details: [formatExp(c.totalExperience), formatCtc(c.currentCtc), c.location].filter(Boolean).join(" · "),
            owner: c.owner?.name ?? "", resumes: c._count.resumes, notes: c._count.notes,
            added: c.createdAt.toLocaleDateString("en-IN", { dateStyle: "medium" }),
          }))}
        />
      ))}
    </div>
  );
}
