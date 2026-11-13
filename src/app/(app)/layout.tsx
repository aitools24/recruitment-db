import { requirePage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can, ROLE_LABELS } from "@/lib/permissions";
import Nav from "@/components/Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requirePage();
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: s.tenantId }, select: { name: true } });
  const links = [
    { href: "/candidates", label: "Candidates", show: true },
    { href: "/candidates/new", label: "Add candidate", show: can(s.role, "editCandidates") },
    { href: "/import", label: "Import", show: can(s.role, "importData") },
    { href: "/duplicates", label: "Duplicates", show: true },
    { href: "/activity", label: "Activity log", show: can(s.role, "viewAuditLog") },
    { href: "/settings", label: "Team & settings", show: true },
  ].filter((l) => l.show);
  return (
    <div className="min-h-screen md:flex">
      <Nav links={links} company={tenant.name} userName={s.name} roleLabel={ROLE_LABELS[s.role]} />
      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
