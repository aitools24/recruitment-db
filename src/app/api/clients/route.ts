import { prisma } from "@/lib/db";
import { HttpError, handler, requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientInput } from "@/lib/clients";

export const GET = handler(async () => {
  const s = await requireApi("viewCandidates");
  return Response.json(await prisma.client.findMany({ where: { tenantId: s.tenantId }, orderBy: { name: "asc" }, select: { id: true, name: true, status: true } }));
});

export const POST = handler(async (req: Request) => {
  const s = await requireApi("editClients");
  const b = clientInput.parse(await req.json());
  if (await prisma.client.findFirst({ where: { tenantId: s.tenantId, name: { equals: b.name, mode: "insensitive" } } })) throw new HttpError(409, `A client called "${b.name}" already exists`);
  const c = await prisma.client.create({ data: { ...b, tenantId: s.tenantId } });
  await audit(s, "CLIENT", `Added client ${c.name}`, { meta: { clientId: c.id } });
  return Response.json(c, { status: 201 });
});
