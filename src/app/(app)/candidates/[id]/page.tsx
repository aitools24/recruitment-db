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
    ["Email", c.email && <a className="text-brand-300 hover:underline" href={`mailto:${c.email}`}>{c.email}</a>],
    ["Phone", c.phone && <a className="text-brand-300 hover:underline" href={`tel:${c.phone}`}>{c.phone}</a>],
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
    ["LinkedIn", c.linkedinUrl && <a className="break-all text-brand-300 hover:underline" target="_blank" rel="noreferrer" href={c.linkedinUrl.startsWith("http") ? c.linkedinUrl : `https://${c.linkedinUrl}`}>{c.linkedinUrl}</a>],
    ["Source", c.source],
    ["Owner", c.owner?.name],
    ["Added", dt(c.createdAt)],
    ["Updated", dt(c.updatedAt)],
  ];

  return (
    <div className="max-w-6xl space-y-4">
      <Link href="/candidates" className="text-sm text-slate-400 hover:underline">← All candidates</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">{c.fullName}</h1>
          <p className="text-slate-300">{[c.currentTitle, c.currentCompany].filter(Boolean).join(" at ") || "No current role recorded"}</p>
          <span className={`neu-in-sm mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs ${c.status === "Active" ? "text-emerald-300" : c.status === "Do not contact" ? "text-red-300" : "text-slate-300"}`}>{c.status}</span>
        </div>
        <div className="flex gap-2">
          {canEdit && <Link href={`/candidates/${c.id}/edit`} className="btn-secondary">Edit profile</Link>}
          {can(s.role, "deleteCandidates") && <DeleteCandidate id={c.id} name={c.fullName} />}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card p-5">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              {facts.filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex min-w-0 gap-2 text-sm"><dt className="w-32 shrink-0 text-slate-400">{k}</dt><dd className="min-w-0 break-words [overflow-wrap:anywhere]">{v}</dd></div>
              ))}
            </dl>
            {c.education && <p className="mt-3 text-sm"><span className="text-slate-400">Education: </span>{c.education}</p>}
          </section>

          <section className="card p-5">
            <h2 className="mb-2 text-sm font-semibold">Skills</h2>
            <div className="flex flex-wrap gap-1.5">{c.skills.length ? c.skills.map((sk) => <Link key={sk} href={`/candidates?skills=${encodeURIComponent(sk)}`} className="chip hover:text-brand-300">{sk}</Link>) : <span className="text-sm text-slate-400">No skills recorded</span>}</div>
            <h2 className="mb-2 mt-4 text-sm font-semibold">Tags</h2>
            <TagEditor id={c.id} tags={c.tags} canEdit={canEdit} />
          </section>

          <section className="card p-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Resumes</h2>
              {canEdit && <ResumeUpload id={c.id} />}
            </div>
            {c.resumes.length ? (
              <ul className="divide-y divide-white/[0.05] text-sm">
                {c.resumes.map((r, i) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-medium">v{r.version}</span> {r.fileName}
                      {i === 0 && <span className="chip-blue ml-2">Latest</span>}
                      <span className="ml-2 text-xs text-slate-400">{Math.round(r.size / 1024)} KB · {dt(r.createdAt)}</span>
                    </span>
                    {canDownload && (
                      <span className="flex gap-2">
                        {r.mimeType === "application/pdf" && <a className="text-brand-300 hover:underline" target="_blank" href={`/api/resumes/${r.id}?inline=1`}>View</a>}
                        <a className="text-brand-300 hover:underline" href={`/api/resumes/${r.id}`}>Download</a>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-slate-400">No resume uploaded yet.</p>}
            {c.resumeText && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-brand-300">Show resume text</summary>
                <pre className="neu-in mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl p-4 font-sans text-xs leading-relaxed text-slate-300">{c.resumeText}</pre>
              </details>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <NotesPanel id={c.id} canEdit={canEdit} notes={c.notes.map((n) => ({ id: n.id, body: n.body, author: n.author?.name ?? "Deleted user", createdAt: dt(n.createdAt) }))} />
          <section className="card p-5">
            <h2 className="mb-2 text-sm font-semibold">Activity</h2>
            <ul className="space-y-2 text-sm">
              {c.auditLogs.map((a) => (
                <li key={a.id}><span className="text-slate-100">{a.message}</span><div className="text-xs text-slate-400">{a.user?.name ?? "System"} · {dt(a.createdAt)}</div></li>
              ))}
              {!c.auditLogs.length && <li className="text-slate-400">No activity yet.</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
