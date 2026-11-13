import Link from "next/link";
import { requirePage } from "@/lib/auth";
import { prisma } from "@/lib/db";

const ACTIONS = ["EXPORT", "IMPORT", "VIEW", "RESUME_DOWNLOAD", "CREATE", "UPDATE", "DELETE", "MERGE", "NOTE", "RESUME_UPLOAD", "LOGIN", "USER_CREATE", "USER_UPDATE", "SETTINGS"];
const PAGE = 50;

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ action?: string; userId?: string; page?: string }> }) {
  const s = await requirePage("viewAuditLog");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = { tenantId: s.tenantId, ...(sp.action ? { action: sp.action } : {}), ...(sp.userId ? { userId: sp.userId } : {}) };
  const [logs, total, users] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: PAGE, skip: (page - 1) * PAGE, include: { user: { select: { name: true } }, candidate: { select: { id: true, fullName: true } } } }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({ where: { tenantId: s.tenantId }, select: { id: true, name: true } }),
  ]);
  const qs = (p: number) => new URLSearchParams({ ...(sp.action ? { action: sp.action } : {}), ...(sp.userId ? { userId: sp.userId } : {}), page: String(p) }).toString();
  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Activity log</h1>
        <p className="text-sm text-slate-300">Who viewed, edited, imported, exported, merged or deleted what.</p>
      </div>
      <form className="flex flex-wrap gap-2">
        <select name="action" defaultValue={sp.action ?? ""} className="input w-auto"><option value="">All actions</option>{ACTIONS.map((a) => <option key={a} value={a}>{a.replace("_", " ").toLowerCase()}</option>)}</select>
        <select name="userId" defaultValue={sp.userId ?? ""} className="input w-auto"><option value="">All users</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        <button className="btn-secondary">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead className="border-b border-white/[0.06] bg-white/[0.03]"><tr><th className="th">When</th><th className="th">User</th><th className="th">Action</th><th className="th">Candidate</th><th className="th">Details</th></tr></thead>
          <tbody className="divide-y divide-white/[0.05]">
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="td whitespace-nowrap">{l.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</td>
                <td className="td">{l.user?.name ?? "—"}</td>
                <td className="td"><span className={`chip ${l.action === "EXPORT" || l.action === "DELETE" ? "text-amber-300" : ""}`}>{l.action.replace("_", " ").toLowerCase()}</span></td>
                <td className="td">{l.candidate && <Link className="text-brand-300 hover:underline" href={`/candidates/${l.candidate.id}`}>{l.candidate.fullName}</Link>}</td>
                <td className="td text-slate-200">{l.message}</td>
              </tr>
            ))}
            {!logs.length && <tr><td colSpan={5} className="td py-6 text-center text-slate-400">Nothing here yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {total > PAGE && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && <Link className="btn-secondary" href={`?${qs(page - 1)}`}>Previous</Link>}
          <span>Page {page} of {Math.ceil(total / PAGE)}</span>
          {page * PAGE < total && <Link className="btn-secondary" href={`?${qs(page + 1)}`}>Next</Link>}
        </div>
      )}
    </div>
  );
}
