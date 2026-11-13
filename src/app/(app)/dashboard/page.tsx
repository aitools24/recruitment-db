import Link from "next/link";
import { requirePage } from "@/lib/auth";
import { dashboardData } from "@/lib/dashboard";
import { can } from "@/lib/permissions";
import { BarList, Panel, StatTile, WeeklyColumns } from "@/components/DashboardCharts";

const fmt = (v: number) => v.toLocaleString("en-IN");
const ago = (d: Date) => {
  const m = Math.round((Date.now() - d.getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

export default async function Dashboard() {
  const s = await requirePage("viewCandidates");
  const d = await dashboardData(s.tenantId);
  const t = d.totals;
  const delta = t.prevMonth ? Math.round(((t.month - t.prevMonth) / t.prevMonth) * 100) : null;
  const pct = (v: number) => (t.total ? `${Math.round((v / t.total) * 100)}% of database` : "");
  const since = (days: number) => new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  return (
    <div className="max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Dashboard</h1>
          <p className="text-sm text-slate-400">Your candidate database at a glance. Click any bar to see those candidates.</p>
        </div>
        <div className="flex gap-2">
          {can(s.role, "importData") && <Link href="/import" className="btn-secondary">Import</Link>}
          <Link href="/candidates" className="btn-primary">Search candidates</Link>
        </div>
      </div>

      {t.total === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-slate-200">No candidates yet.</p>
          <p className="mt-1 text-sm text-slate-400">Import a spreadsheet or upload resumes to fill your dashboard.</p>
          {can(s.role, "importData") && <Link href="/import" className="btn-primary mt-4">Import candidates</Link>}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="Total candidates" value={fmt(t.total)} sub={`${fmt(t.active)} active · ${fmt(t.withResume)} with resume`} href="/candidates" />
            <StatTile label="Added in last 30 days" value={fmt(t.month)}
              sub={delta === null || delta === 0 ? `${fmt(t.week)} this week${delta === 0 ? " · same as previous 30 days" : ""}` : <><span className={delta >= 0 ? "text-emerald-300" : "text-red-300"}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%</span> vs previous 30 days</>}
              href={`/candidates?addedFrom=${since(30)}`} />
            <StatTile label="Can join within 15 days" value={fmt(t.quickJoin)} sub={pct(t.quickJoin)} href="/candidates?noticeMax=15" />
            <StatTile label="Average experience" value={t.avgExp === null ? "—" : `${t.avgExp} yrs`}
              sub={t.duplicates ? <Link href="/duplicates" className="text-amber-300 hover:underline">⚠ {t.duplicates} possible duplicate{t.duplicates === 1 ? "" : "s"}</Link> : "No duplicates found"} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Candidates added per week" sub="Last 12 weeks" className="lg:col-span-2">
              <WeeklyColumns data={d.weekly} />
            </Panel>
            <Panel title="By source" sub="Where candidates came from">
              <BarList rows={d.source} total={t.total} />
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="By industry"><BarList rows={d.industry} total={t.total} /></Panel>
            <Panel title="Top skills" sub="Share of candidates with each skill"><BarList rows={d.skills} total={t.total} empty="No skills recorded yet" /></Panel>
            <Panel title="By recruiter" sub="Candidates owned (added in last 30 days)">
              <BarList rows={d.owners.map((o) => ({ ...o, label: `${o.label} (${o.month})` }))} total={t.total} />
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Notice period"><BarList rows={d.notice} total={t.total} /></Panel>
            <Panel title="Total experience"><BarList rows={d.experience} total={t.total} /></Panel>
            <Panel title="Recent activity">
              <ul className="space-y-3 text-sm">
                {d.recentActivity.map((a) => (
                  <li key={a.id} className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden />
                    <div className="min-w-0">
                      <div className="text-slate-200">
                        {a.candidate ? <Link className="text-brand-300 hover:underline" href={`/candidates/${a.candidate.id}`}>{a.candidate.fullName}</Link> : null}
                        {a.candidate ? ": " : ""}{a.message}
                      </div>
                      <div className="text-xs text-slate-400">{a.user?.name ?? "System"} · {ago(a.createdAt)}</div>
                    </div>
                  </li>
                ))}
                {!d.recentActivity.length && <li className="text-slate-400">Nothing yet.</li>}
              </ul>
              {d.recentImports.length > 0 && (
                <>
                  <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-slate-400">Recent imports</h3>
                  <ul className="mt-2 space-y-2 text-sm">
                    {d.recentImports.map((j) => (
                      <li key={j.id} className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-slate-200" title={j.fileName}>{j.fileName}</span>
                        <span className="shrink-0 text-xs tabular-nums text-slate-400">+{j.created} new{j.failed ? ` · ${j.failed} failed` : ""}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
