import { prisma } from "@/lib/db";
import { HttpError, handler, requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { candidateInput, findDuplicates, parseSearchParams, searchCandidates, toCandidateData } from "@/lib/candidates";

export const GET = handler(async (req: Request) => {
  const s = await requireApi("viewCandidates");
  const params = parseSearchParams(new URL(req.url).searchParams);
  return Response.json(await searchCandidates(s.tenantId, params));
});

export const POST = handler(async (req: Request) => {
  const s = await requireApi("editCandidates");
  const body = await req.json();
  const data = toCandidateData(candidateInput.parse(body));
  if (!data.fullName) throw new HttpError(400, "Name is required");
  if (data.ownerId && !(await prisma.user.findFirst({ where: { id: data.ownerId as string, tenantId: s.tenantId } }))) data.ownerId = s.userId;
  if (!body.ignoreDuplicates) {
    const dups = await findDuplicates(s.tenantId, { email: data.email as string, phone: data.phone as string });
    if (dups.length) return Response.json({ error: "Possible duplicate", duplicates: dups }, { status: 409 });
  }
  const c = await prisma.candidate.create({
    data: { ...(data as { fullName: string }), ownerId: (data.ownerId as string) ?? s.userId, tenantId: s.tenantId, createdById: s.userId },
  });
  await audit(s, "CREATE", "Created candidate", { candidateId: c.id });
  return Response.json(c, { status: 201 });
});
