import { requirePage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can, ROLE_LABELS } from "@/lib/permissions";
import Nav from "@/components/Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requirePage();
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: s.tenantId }, select: { name: true } });
  const links = [
    { href: "/dashboard", label: "Dashboard", icon: "dashboard", color: "#3987e5", show: true },
    { href: "/candidates", label: "Candidates", icon: "users", color: "#199e70", show: true },
    { href: "/candidates/new", label: "Add candidate", icon: "userPlus", color: "#0ca30c", show: can(s.role, "editCandidates") },
    { href: "/import", label: "Import", icon: "upload", color: "#d95926", show: can(s.role, "importData") },
    { href: "/duplicates", label: "Duplicates", icon: "copy", color: "#c98500", show: true },
    { href: "/activity", label: "Activity log", icon: "activity", color: "#d55181", show: can(s.role, "viewAuditLog") },
    { href: "/settings", label: "Team & settings", icon: "settings", color: "#9085e9", show: true },
  ].filter((l) => l.show);
  return (
    <div className="min-h-screen md:flex">
      <Nav links={links} company={tenant.name} userName={s.name} roleLabel={ROLE_LABELS[s.role]} />
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
