import { prisma } from "@/lib/db";
import { HttpError, handler, requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { deleteFile } from "@/lib/storage";
import { candidateInput, findDuplicates, toCandidateData } from "@/lib/candidates";

type Ctx = { params: Promise<{ id: string }> };

async function load(tenantId: string, id: string) {
  const c = await prisma.candidate.findFirst({ where: { id, tenantId } });
  if (!c) throw new HttpError(404, "Candidate not found");
  return c;
}

export const GET = handler(async (_req: Request, { params }: Ctx) => {
  const s = await requireApi("viewCandidates");
  const c = await load(s.tenantId, (await params).id);
  return Response.json(c);
});

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireApi("editCandidates");
  const { id } = await params;
  const before = await load(s.tenantId, id);
  const body = await req.json();
  const data = toCandidateData(candidateInput.parse(body));
  if ("fullName" in data && !data.fullName) throw new HttpError(400, "Name is required");
  if (data.ownerId && !(await prisma.user.findFirst({ where: { id: data.ownerId as string, tenantId: s.tenantId } }))) {
    throw new HttpError(400, "Unknown owner");
  }
  if (!body.ignoreDuplicates && ("email" in data || "phone" in data)) {
    const dups = await findDuplicates(s.tenantId, { email: (data.email as string) ?? before.email, phone: (data.phone as string) ?? before.phone, excludeId: id });
    if (dups.length) return Response.json({ error: "Possible duplicate", duplicates: dups }, { status: 409 });
  }
  const changed = Object.keys(data).filter((k) => JSON.stringify((before as Record<string, unknown>)[k]) !== JSON.stringify(data[k]) && !k.endsWith("Lower") && k !== "phoneNormalized");
  const c = await prisma.candidate.update({ where: { id }, data });
  if (changed.length) await audit(s, "UPDATE", `Updated ${changed.join(", ")}`, { candidateId: id });
  return Response.json(c);
});

export const DELETE = handler(async (_req: Request, { params }: Ctx) => {
  const s = await requireApi("deleteCandidates");
  const { id } = await params;
  const c = await load(s.tenantId, id);
  const resumes = await prisma.resume.findMany({ where: { candidateId: id } });
  await prisma.candidate.delete({ where: { id } });
  await Promise.all(resumes.map((r) => deleteFile(r.storageKey)));
  await audit(s, "DELETE", `Deleted candidate ${c.fullName}`, { meta: { email: c.email, phone: c.phone } });
  return Response.json({ ok: true });
});
