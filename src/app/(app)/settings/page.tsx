import { requirePage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/permissions";
import { ExportSettings, MyAccount, TeamManager } from "@/components/SettingsWidgets";

export default async function SettingsPage() {
  const s = await requirePage();
  const [tenant, users] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: s.tenantId } }),
    prisma.user.findMany({ where: { tenantId: s.tenantId }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, role: true, active: true } }),
  ]);
  const isAdmin = s.role === "ADMIN";
  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Team &amp; settings</h1>
      <MyAccount id={s.userId} name={s.name} />
      <section>
        <h2 className="mb-2 text-sm font-semibold">Team</h2>
        <TeamManager users={users} me={s.userId} isAdmin={isAdmin} />
        <div className="card mt-3 p-4 text-xs text-slate-300">
          <div className="mb-1 font-semibold text-slate-100">What each role can do</div>
          <ul className="list-disc space-y-0.5 pl-5">
            <li><b>{ROLE_LABELS.ADMIN}</b>: everything, including managing users and workspace settings.</li>
            <li><b>{ROLE_LABELS.MANAGER}</b>: add, edit, import and delete candidates, merge duplicates, see the activity log.</li>
            <li><b>{ROLE_LABELS.RECRUITER}</b>: add, edit and import candidates, add notes, download resumes.</li>
            <li><b>{ROLE_LABELS.VIEWER}</b>: search and read profiles only. No resume downloads.</li>
            <li>Exporting is controlled separately below.</li>
          </ul>
        </div>
      </section>
      <ExportSettings isAdmin={isAdmin} roles={tenant.exportRoles} maxRows={tenant.exportMaxRows} />
    </div>
  );
}
