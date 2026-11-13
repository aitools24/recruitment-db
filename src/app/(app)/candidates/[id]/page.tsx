import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { formatCtc, formatExp, formatNotice } from "@/lib/normalize";
import { DeleteCandidate, NotesPanel, ResumeUpload, TagEditor } from "@/components/ProfileWidgets";

const dt = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requirePage("viewCandidates");
  const c = await prisma.candidate.findFirst({
    where: { id: (await params).id, tenantId: s.tenantId },
    include: {
      owner: { select: { name: true } },
      resumes: { orderBy: { version: "desc" }, select: { id: true, version: true, fileName: true, size: true, createdAt: true, mimeType: true } },
      notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      auditLogs: { where: { action: { not: "VIEW" } }, orderBy: { createdAt: "desc" }, take: 50, include: { user: { select: { name: true } } } },
    },
  });
  if (!c) notFound();
  await audit(s, "VIEW", "Viewed profile", { candidateId: c.id });
  const canEdit = can(s.role, "editCandidates");
  const canDownload = can(s.role, "downloadResumes");

  const facts: [string, React.ReactNode][] = [
    ["Email", c.email && <a className="text-brand-700 hover:underline" href={`mailto:${c.email}`}>{c.email}</a>],
    ["Phone", c.phone && <a className="text-brand-700 hover:underline" href={`tel:${c.phone}`}>{c.phone}</a>],
    ["Alternate phone", c.altPhone],
    ["Location", c.location],
    ["Industry", c.industry],
    ["Functional area", c.functionalArea],
    ["Total experience", formatExp(c.totalExperience)],
    ["Current CTC", formatCtc(c.currentCtc)],
    ["Expected CTC", formatCtc(c.expectedCtc)],
    ["Notice period", formatNotice(c.noticePeriodDays)],
    ["Highest degree", c.highestDegree],
    ["College", c.college],
    ["Certifications", c.certifications],
    ["Languages", c.languages],
    ["LinkedIn", c.linkedinUrl && <a className="break-all text-brand-700 hover:underline" target="_blank" rel="noreferrer" href={c.linkedinUrl.startsWith("http") ? c.linkedinUrl : `https://${c.linkedinUrl}`}>{c.linkedinUrl}</a>],
    ["Source", c.source],
    ["Owner", c.owner?.name],
    ["Added", dt(c.createdAt)],
    ["Updated", dt(c.updatedAt)],
  ];

  return (
    <div className="max-w-6xl space-y-4">
      <Link href="/candidates" className="text-sm text-gray-500 hover:underline">← All candidates</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{c.fullName}</h1>
          <p className="text-gray-600">{[c.currentTitle, c.currentCompany].filter(Boolean).join(" at ") || "No current role recorded"}</p>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs ${c.status === "Active" ? "bg-green-50 text-green-700" : c.status === "Do not contact" ? "bg-red-50 text-red-700" : "bg-gray-100 text-gray-700"}`}>{c.status}</span>
        </div>
        <div className="flex gap-2">
          {canEdit && <Link href={`/candidates/${c.id}/edit`} className="btn-secondary">Edit profile</Link>}
          {can(s.role, "deleteCandidates") && <DeleteCandidate id={c.id} name={c.fullName} />}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card p-4">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {facts.filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex gap-2 text-sm"><dt className="w-36 shrink-0 text-gray-500">{k}</dt><dd className="min-w-0">{v}</dd></div>
              ))}
            </dl>
            {c.education && <p className="mt-3 text-sm"><span className="text-gray-500">Education: </span>{c.education}</p>}
          </section>

          <section className="card p-4">
            <h2 className="mb-2 text-sm font-semibold">Skills</h2>
            <div className="flex flex-wrap gap-1.5">{c.skills.length ? c.skills.map((sk) => <Link key={sk} href={`/candidates?skills=${encodeURIComponent(sk)}`} className="chip hover:bg-gray-200">{sk}</Link>) : <span className="text-sm text-gray-400">No skills recorded</span>}</div>
            <h2 className="mb-2 mt-4 text-sm font-semibold">Tags</h2>
            <TagEditor id={c.id} tags={c.tags} canEdit={canEdit} />
          </section>

          <section className="card p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Resumes</h2>
              {canEdit && <ResumeUpload id={c.id} />}
            </div>
            {c.resumes.length ? (
              <ul className="divide-y divide-gray-100 text-sm">
                {c.resumes.map((r, i) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-medium">v{r.version}</span> {r.fileName}
                      {i === 0 && <span className="chip-blue ml-2">Latest</span>}
                      <span className="ml-2 text-xs text-gray-400">{Math.round(r.size / 1024)} KB · {dt(r.createdAt)}</span>
                    </span>
                    {canDownload && (
                      <span className="flex gap-2">
                        {r.mimeType === "application/pdf" && <a className="text-brand-700 hover:underline" target="_blank" href={`/api/resumes/${r.id}?inline=1`}>View</a>}
                        <a className="text-brand-700 hover:underline" href={`/api/resumes/${r.id}`}>Download</a>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-gray-400">No resume uploaded yet.</p>}
            {c.resumeText && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-brand-700">Show resume text</summary>
                <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded bg-gray-50 p-3 font-sans text-xs text-gray-700">{c.resumeText}</pre>
              </details>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <NotesPanel id={c.id} canEdit={canEdit} notes={c.notes.map((n) => ({ id: n.id, body: n.body, author: n.author?.name ?? "Deleted user", createdAt: dt(n.createdAt) }))} />
          <section className="card p-4">
            <h2 className="mb-2 text-sm font-semibold">Activity</h2>
            <ul className="space-y-2 text-sm">
              {c.auditLogs.map((a) => (
                <li key={a.id}><span className="text-gray-800">{a.message}</span><div className="text-xs text-gray-400">{a.user?.name ?? "System"} · {dt(a.createdAt)}</div></li>
              ))}
              {!c.auditLogs.length && <li className="text-gray-400">No activity yet.</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
