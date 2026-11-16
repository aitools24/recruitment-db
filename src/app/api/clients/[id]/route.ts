import { prisma } from "@/lib/db";
import { HttpError, handler, requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientInput } from "@/lib/clients";

type Ctx = { params: Promise<{ id: string }> };

async function load(tenantId: string, id: string) {
  const c = await prisma.client.findFirst({ where: { id, tenantId } });
  if (!c) throw new HttpError(404, "Client not found");
  return c;
}

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireApi("editClients");
  const { id } = await params;
  const old = await load(s.tenantId, id);
  const b = clientInput.partial().parse(await req.json());
  if (b.name && b.name.toLowerCase() !== old.name.toLowerCase()
    && await prisma.client.findFirst({ where: { tenantId: s.tenantId, name: { equals: b.name, mode: "insensitive" }, id: { not: id } } })) {
    throw new HttpError(409, `A client called "${b.name}" already exists`);
  }
  const [c] = await prisma.$transaction([
    prisma.client.update({ where: { id }, data: b }),
    ...(b.name && b.name !== old.name ? [prisma.candidate.updateMany({ where: { tenantId: s.tenantId, clientId: id }, data: { clientName: b.name } })] : []),
  ]);
  await audit(s, "CLIENT", `Updated client ${c.name}`, { meta: { clientId: id } });
  return Response.json(c);
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const s = await requireApi("deleteClients");
  const { id } = await params;
  const c = await load(s.tenantId, id);
  const active = await prisma.candidate.count({ where: { tenantId: s.tenantId, clientId: id, stage: { not: null } } });
  if (active) throw new HttpError(409, `${c.name} has ${active} candidate(s) in the pipeline. Move them first, or mark the client Inactive instead.`);
  await prisma.client.delete({ where: { id } });
  await audit(s, "CLIENT", `Deleted client ${c.name}`, { meta: { clientId: id } });
  return Response.json({ ok: true });
});
