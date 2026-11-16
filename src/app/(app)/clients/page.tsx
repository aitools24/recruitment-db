import Link from "next/link";
import { requirePage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { CLIENT_STATUS_COLOR, termsFor } from "@/lib/clients";
import { STAGES } from "@/lib/pipeline";
import { NEUTRAL, accent } from "@/lib/colors";
import { Legend } from "@/components/PipelineCharts";

const inr = (v: number) => `₹${Math.round(v).toLocaleString("en-IN")}`;

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const s = await requirePage("viewCandidates");
  const { status, q } = await searchParams;
  const [tenant, clients] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: s.tenantId }, select: { billingAfterDays: true, guaranteeDays: true } }),
    prisma.client.findMany({
      where: { tenantId: s.tenantId, ...(status ? { status } : {}), ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { contactName: { contains: q, mode: "insensitive" } }, { industry: { contains: q, mode: "insensitive" } }] } : {}) },
      orderBy: { name: "asc" },
      include: { candidates: { where: { stage: { not: null } }, select: { stage: true, billingAmount: true } } },
    }),
  ]);
  const all = clients.flatMap((c) => c.candidates);
  const totals = {
    clients: clients.length,
    active: clients.filter((c) => c.status === "Active").length,
    inPipeline: all.length,
    placed: all.filter((c) => c.stage === "ONBOARDING" || c.stage === "BILLING").length,
    billed: all.reduce((a, c) => a + (c.stage === "BILLING" ? c.billingAmount ?? 0 : 0), 0),
  };

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Clients</h1>
          <p className="text-sm text-slate-400">Companies you recruit for, their contacts and terms, and where their candidates are.</p>
        </div>
        {can(s.role, "editClients") && <Link href="/clients/new" className="btn-primary">+ Add client</Link>}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {([["Clients", `${totals.clients}`, `${totals.active} active`, "#3987e5"], ["Candidates in pipeline", `${totals.inPipeline}`, "across all clients", "#d95926"],
          ["Placed", `${totals.placed}`, "onboarding or billing", "#d55181"], ["Billed", inr(totals.billed), "billing amounts recorded", "#0ca30c"]] as const).map(([l, v, sub, c]) => (
          <div key={l} className="card relative overflow-hidden p-5">
            <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${c}, transparent)` }} />
            <div className="text-xs font-medium text-slate-400">{l}</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums text-slate-100">{v}</div>
            <div className="mt-1 text-xs text-slate-400">{sub}</div>
          </div>
        ))}
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} className="input w-64" placeholder="Search name, contact, industry" />
        <select name="status" defaultValue={status ?? ""} className="input w-40"><option value="">All statuses</option><option>Active</option><option>On hold</option><option>Inactive</option></select>
        <button className="btn-secondary">Filter</button>
        <div className="ml-auto hidden md:block"><Legend /></div>
      </form>

      {clients.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-slate-200">{q || status ? "No clients match." : "No clients yet."}</p>
          {can(s.role, "editClients") && !q && !status && <Link href="/clients/new" className="btn-primary mt-4">Add your first client</Link>}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((c) => {
            const t = termsFor(c, tenant);
            const n = c.candidates.length;
            const counts = Object.fromEntries(STAGES.map((st) => [st.key, c.candidates.filter((x) => x.stage === st.key).length]));
            return (
              <Link key={c.id} href={`/clients/${c.id}`} className="card block p-5 transition hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base font-bold text-white shadow-[3px_3px_8px_#141922,-2px_-2px_6px_#2a3346]"
                      style={{ background: "linear-gradient(135deg, #3987e5, #9085e9)" }}>{c.name.slice(0, 1).toUpperCase()}</span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-100">{c.name}</div>
                      <div className="truncate text-xs text-slate-400">{[c.industry, c.location].filter(Boolean).join(" · ") || "No industry set"}</div>
                    </div>
                  </div>
                  <span className="accent-chip shrink-0" style={accent(CLIENT_STATUS_COLOR[c.status] ?? NEUTRAL)}>{c.status}</span>
                </div>
                <div className="mt-4 text-sm text-slate-300">
                  {c.contactName ? <>{c.contactName}{c.contactTitle ? <span className="text-slate-400"> · {c.contactTitle}</span> : null}</> : <span className="text-slate-400">No contact added</span>}
                </div>
                <div className="mt-4">
                  <div className="mb-1.5 flex justify-between text-xs text-slate-400"><span>{n} in pipeline</span><span>{c.feePercent !== null ? `${c.feePercent}% fee · ` : ""}{t.billingAfterDays}d bill · {t.guaranteeDays}d guarantee</span></div>
                  <div className="neu-in-sm flex h-3 gap-[2px] rounded-full p-[2px]" title={STAGES.filter((st) => counts[st.key]).map((st) => `${st.label}: ${counts[st.key]}`).join("\n") || "Nobody in the pipeline"}>
                    {STAGES.filter((st) => counts[st.key]).map((st) => <span key={st.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ flexGrow: counts[st.key], flexBasis: 0, background: st.color }} />)}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
