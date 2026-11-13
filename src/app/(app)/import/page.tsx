import { requirePage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CANDIDATE_FIELDS } from "@/lib/candidates";
import { SOURCES } from "@/lib/normalize";
import ImportTabs from "@/components/ImportTabs";

export default async function ImportPage() {
  const s = await requirePage("importData");
  const jobs = await prisma.importJob.findMany({ where: { tenantId: s.tenantId }, orderBy: { createdAt: "desc" }, take: 15 });
  return (
    <div className="max-w-6xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Import candidates</h1>
      <ImportTabs fields={CANDIDATE_FIELDS.map((f) => ({ key: f.key, label: f.label }))} sources={SOURCES} />
      <section>
        <h2 className="mb-2 text-sm font-semibold">Recent imports</h2>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-white/[0.06] bg-white/[0.03]"><tr><th className="th">When</th><th className="th">Type</th><th className="th">File</th><th className="th">Rows / files</th><th className="th">New</th><th className="th">Updated</th><th className="th">Skipped</th><th className="th">Failed</th></tr></thead>
            <tbody className="divide-y divide-white/[0.05]">
              {jobs.map((j) => (
                <tr key={j.id}>
                  <td className="td whitespace-nowrap">{j.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                  <td className="td">{j.kind === "RESUMES" ? "Resumes" : "Spreadsheet"}</td>
                  <td className="td max-w-xs truncate" title={j.fileName}>{j.fileName}</td>
                  <td className="td">{j.total}</td><td className="td">{j.created}</td><td className="td">{j.updated}</td><td className="td">{j.skipped}</td>
                  <td className={`td ${j.failed ? "text-red-300" : ""}`}>{j.failed}</td>
                </tr>
              ))}
              {!jobs.length && <tr><td colSpan={8} className="td py-6 text-center text-slate-400">No imports yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
