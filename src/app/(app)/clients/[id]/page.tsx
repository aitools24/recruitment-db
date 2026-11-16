import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { CLIENT_STATUS_COLOR, termsFor } from "@/lib/clients";
import { STAGES, fmtDate, placementTimer, stageInfo, timerBadge } from "@/lib/pipeline";
import { NEUTRAL, accent } from "@/lib/colors";
import { ClientActions } from "@/components/ClientForm";
import { StageColumns } from "@/components/PipelineCharts";
import { Panel } from "@/components/DashboardCharts";

const TONE = { wait: "#c98500", due: "#e66767", ok: "#0ca30c" } as const;
const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
const inr = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requirePage("viewCandidates");
  const c = await prisma.client.findFirst({
    where: { id: (await params).id, tenantId: s.tenantId },
    include: {
      candidates: {
        orderBy: { stageUpdatedAt: { sort: "desc", nulls: "last" } },
        select: { id: true, fullName: true, stage: true, jobTitle: true, joiningDate: true, billedOn: true, billingAmount: true, offerCtc: true, owner: { select: { name: true } } },
      },
    },
  });
  if (!c) notFound();
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: s.tenantId }, select: { billingAfterDays: true, guaranteeDays: true } });
  const terms = termsFor(c, tenant);
  const active = c.candidates.filter((x) => x.stage);
  const counts = Object.fromEntries(STAGES.map((st) => [st.key, active.filter((x) => x.stage === st.key).length]));
  const billed = active.reduce((a, x) => a + (x.stage === "BILLING" ? x.billingAmount ?? 0 : 0), 0);
  const site = c.website && (c.website.startsWith("http") ? c.website : `https://${c.website}`);

  const facts: [string, React.ReactNode][] = [
    ["Contact", c.contactName && <>{c.contactName}{c.contactTitle && <span className="text-slate-400"> · {c.contactTitle}</span>}</>],
    ["Email", c.contactEmail && <a className="text-brand-300 hover:underline" href={`mailto:${c.contactEmail}`}>{c.contactEmail}</a>],
    ["Phone", c.contactPhone && <a className="text-brand-300 hover:underline" href={`tel:${c.contactPhone}`}>{c.contactPhone}</a>],
    ["Website", site && <a className="text-brand-300 hover:underline" target="_blank" rel="noreferrer" href={site}>{c.website}</a>],
    ["Industry", c.industry],
    ["Location", c.location],
    ["GSTIN", c.gstin],
    ["Placement fee", c.feePercent !== null ? `${c.feePercent}% of annual CTC` : null],
    ["Bill after", `${terms.billingAfterDays} days${c.billingAfterDays === null ? " (default)" : ""}`],
    ["Guarantee", `${terms.guaranteeDays} days${c.guaranteeDays === null ? " (default)" : ""}`],
    ["Agreement", c.agreementStart || c.agreementEnd ? `${c.agreementStart ? fmtDate(c.agreementStart) : "—"} to ${c.agreementEnd ? fmtDate(c.agreementEnd) : "open"}` : null],
  ];
  const initial = Object.fromEntries(Object.entries(c).filter(([k]) => k !== "candidates").map(([k, v]) => [k, v instanceof Date ? ymd(v) : v === null ? "" : String(v)]));

  return (
    <div className="max-w-6xl space-y-4">
      <Link href="/clients" className="text-sm text-slate-400 hover:underline">← All clients</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">{c.name}</h1>
          <p className="text-slate-300">{[c.industry, c.location].filter(Boolean).join(" · ") || "Client"}</p>
          <span className="accent-chip mt-2" style={accent(CLIENT_STATUS_COLOR[c.status] ?? NEUTRAL)}>{c.status}</span>
        </div>
        <Link href={`/pipeline?client=${c.id}`} className="btn-secondary">View in pipeline</Link>
      </div>
      <ClientActions id={c.id} name={c.name} initial={initial} defaults={tenant} canEdit={can(s.role, "editClients")} canDelete={can(s.role, "deleteClients")} />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-1">
          <h2 className="mb-3 text-sm font-semibold">Details</h2>
          <dl className="space-y-2 text-sm">
            {facts.filter(([, v]) => v).map(([k, v]) => <div key={k} className="flex gap-2"><dt className="w-28 shrink-0 text-slate-400">{k}</dt><dd className="min-w-0 [overflow-wrap:anywhere]">{v}</dd></div>)}
          </dl>
          {c.notes && <p className="neu-in-sm mt-4 whitespace-pre-wrap rounded-xl p-3 text-sm text-slate-300">{c.notes}</p>}
        </section>
        <Panel title="Candidates by stage" sub={`${active.length} in pipeline${billed ? ` · ${inr(billed)} billed` : ""}`} className="lg:col-span-2">
          {active.length ? <StageColumns counts={counts} /> : <p className="text-sm text-slate-400">No candidates submitted to {c.name} yet. Choose this client when you move a candidate to “Submitted to client”.</p>}
        </Panel>
      </div>

      <section className="card overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead className="border-b border-white/[0.06] bg-white/[0.03]">
            <tr><th className="th">Candidate</th><th className="th">Position</th><th className="th">Stage</th><th className="th">Joining</th><th className="th">Billing / guarantee</th><th className="th">Owner</th></tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {c.candidates.map((x) => {
              const st = stageInfo(x.stage);
              const b = x.joiningDate && x.stage ? timerBadge(placementTimer(x.joiningDate, terms, x.billedOn)) : null;
              return (
                <tr key={x.id}>
                  <td className="td"><Link href={`/candidates/${x.id}`} className="font-medium text-brand-300 hover:underline">{x.fullName}</Link></td>
                  <td className="td">{x.jobTitle ?? "—"}</td>
                  <td className="td">{st ? <span className="accent-chip" style={accent(st.color)}>{st.label}</span> : <span className="text-xs text-slate-400">Removed from pipeline</span>}</td>
                  <td className="td whitespace-nowrap">{x.joiningDate ? fmtDate(x.joiningDate) : "—"}</td>
                  <td className="td">{b ? <span className="accent-chip" style={accent(TONE[b.tone])}>{b.text}</span> : "—"}{x.billingAmount ? <span className="ml-2 text-xs text-slate-400">{inr(x.billingAmount)}</span> : null}</td>
                  <td className="td">{x.owner?.name ?? "—"}</td>
                </tr>
              );
            })}
            {!c.candidates.length && <tr><td className="td text-slate-400" colSpan={6}>No candidates yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
