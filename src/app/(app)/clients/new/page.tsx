import Link from "next/link";
import { requirePage } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ClientForm from "@/components/ClientForm";

export default async function NewClient() {
  const s = await requirePage("editClients");
  const defaults = await prisma.tenant.findUniqueOrThrow({ where: { id: s.tenantId }, select: { billingAfterDays: true, guaranteeDays: true } });
  return (
    <div className="max-w-4xl space-y-4">
      <Link href="/clients" className="text-sm text-slate-400 hover:underline">← All clients</Link>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Add client</h1>
      <ClientForm defaults={defaults} />
    </div>
  );
}
