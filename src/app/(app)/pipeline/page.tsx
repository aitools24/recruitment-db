import Link from "next/link";
import { requirePage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { STAGES, addDays, fmtDate, placementTimer, timerBadge, todayIST } from "@/lib/pipeline";
import { accent } from "@/lib/colors";

const TONE = { wait: "#c98500", due: "#e66767", ok: "#0ca30c" } as const;
const ist = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const s = await requirePage("viewCandidates");
  const client = (await searchParams).client?.trim() || undefined;
  const [terms, rows, clients] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: s.tenantId }, select: { billingAfterDays: true, guaranteeDays: true } }),
    prisma.candidate.findMany({
      where: { tenantId: s.tenantId, stage: { not: null }, ...(client ? { clientName: { equals: client, mode: "insensitive" } } : {}) },
      orderBy: { stageUpdatedAt: "desc" },
      select: { id: true, fullName: true, stage: true, stageUpdatedAt: true, clientName: true, jobTitle: true, interviewAt: true, joiningDate: true, billedOn: true, owner: { select: { name: true } } },
    }),
    prisma.candidate.findMany({ where: { tenantId: s.tenantId, clientName: { not: null } }, distinct: ["clientName"], select: { clientName: true }, orderBy: { clientName: "asc" } }),
  ]);

  const now = new Date();
  const today = todayIST(now).getTime();
  const cards = rows.map((r) => ({ ...r, timer: r.joiningDate ? placementTimer(r.joiningDate, terms, r.billedOn, now) : null }));
  const readyToBill = cards.filter((c) => c.timer?.joined && !c.timer.billed && c.timer.daysToBillable <= 0);
  const billSoon = cards.filter((c) => c.timer && !c.timer.billed && c.timer.daysToBillable > 0 && c.timer.daysToBillable <= 7);
  const guaranteeSoon = cards.filter((c) => c.timer?.billed && c.timer.daysToGuaranteeEnd > 0 && c.timer.daysToGuaranteeEnd <= 14);
  const interviews = cards.filter((c) => c.stage === "INTERVIEW" && c.interviewAt && c.interviewAt.getTime() >= now.getTime() - 3600000 && c.interviewAt.getTime() < today + 8 * 86400000);

  const alerts = [
    { title: "Ready to bill", color: "#e66767", items: readyToBill.map((c) => ({ c, sub: `Billable since ${fmtDate(c.timer!.billableOn)}` })) },
    { title: "Billing opens within 7 days", color: "#c98500", items: billSoon.map((c) => ({ c, sub: `${fmtDate(c.timer!.billableOn)} · in ${c.timer!.daysToBillable}d` })) },
    { title: "Guarantee ends within 14 days", color: "#3987e5", items: guaranteeSoon.map((c) => ({ c, sub: `Last day ${fmtDate(addDays(c.timer!.guaranteeEndsOn, -1))} · ${c.timer!.daysToGuaranteeEnd}d left` })) },
    { title: "Upcoming interviews", color: "#9085e9", items: interviews.map((c) => ({ c, sub: ist(c.interviewAt!) })) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Pipeline</h1>
          <p className="text-sm text-slate-400">
            {rows.length} candidate{rows.length === 1 ? "" : "s"} in progress. Billing opens {terms.billingAfterDays} days after joining; guarantee lasts {terms.guaranteeDays} days.
          </p>
        </div>
        <form className="flex items-center gap-2">
          <select name="client" defaultValue={client ?? ""} className="input w-52">
            <option value="">All clients</option>
            {clients.map((c) => <option key={c.clientName} value={c.clientName!}>{c.clientName}</option>)}
          </select>
          <button className="btn-secondary">Filter</button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {alerts.map((a) => (
          <section key={a.title} className="card p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: a.color }} aria-hidden />{a.title}</h2>
              <span className="text-lg font-semibold tabular-nums" style={{ color: a.items.length ? a.color : undefined }}>{a.items.length}</span>
            </div>
            <ul className="space-y-1.5 text-sm">
              {a.items.slice(0, 5).map(({ c, sub }) => (
                <li key={c.id} className="flex items-baseline justify-between gap-2">
                  <Link href={`/candidates/${c.id}`} className="truncate text-brand-300 hover:underline">{c.fullName}</Link>
                  <span className="shrink-0 text-xs text-slate-400">{sub}</span>
                </li>
              ))}
              {!a.items.length && <li className="text-xs text-slate-400">Nothing right now.</li>}
              {a.items.length > 5 && <li className="text-xs text-slate-400">+{a.items.length - 5} more</li>}
            </ul>
          </section>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-slate-200">No one in the pipeline{client ? ` for ${client}` : ""} yet.</p>
          <p className="mt-1 text-sm text-slate-400">Open a candidate&apos;s profile and press <b>Start pipeline</b> to submit them to your internal team.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {STAGES.map((st) => {
            const col = cards.filter((c) => c.stage === st.key);
            return (
              <section key={st.key} className="neu-in flex min-h-40 flex-col rounded-2xl p-3">
                <h2 className="mb-3 flex items-center justify-between gap-2 px-1 text-sm font-semibold">
                  <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: st.color }} aria-hidden />{st.label}</span>
                  <span className="accent-chip" style={accent(st.color)}>{col.length}</span>
                </h2>
                <ul className="space-y-3">
                  {col.map((c) => {
                    const badge = c.timer && timerBadge(c.timer);
                    const days = c.stageUpdatedAt ? Math.floor((now.getTime() - c.stageUpdatedAt.getTime()) / 86400000) : null;
                    return (
                      <li key={c.id} className="card p-3" style={{ borderLeft: `3px solid ${st.color}` }}>
                        <Link href={`/candidates/${c.id}`} className="font-medium text-slate-100 hover:text-brand-300 hover:underline">{c.fullName}</Link>
                        <div className="truncate text-xs text-slate-300" title={[c.jobTitle, c.clientName].filter(Boolean).join(" at ")}>{[c.jobTitle, c.clientName].filter(Boolean).join(" at ") || "No client yet"}</div>
                        {c.stage === "INTERVIEW" && c.interviewAt && <div className="mt-1 text-xs text-amber-300">Interview {ist(c.interviewAt)}</div>}
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 text-[11px] text-slate-400">
                          <span>{days === null ? "" : days === 0 ? "Moved today" : `${days}d in stage`}{c.owner ? ` · ${c.owner.name}` : ""}</span>
                          {badge && <span className="accent-chip" style={accent(TONE[badge.tone])}>{badge.text}</span>}
                        </div>
                      </li>
                    );
                  })}
                  {!col.length && <li className="px-1 text-xs text-slate-400">Empty</li>}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
