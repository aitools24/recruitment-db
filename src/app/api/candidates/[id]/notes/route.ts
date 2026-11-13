import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError, handler, requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireApi("editCandidates");
  const { id } = await params;
  const { body } = z.object({ body: z.string().trim().min(1).max(5000) }).parse(await req.json());
  if (!(await prisma.candidate.findFirst({ where: { id, tenantId: s.tenantId } }))) throw new HttpError(404, "Candidate not found");
  const note = await prisma.note.create({ data: { tenantId: s.tenantId, candidateId: id, authorId: s.userId, body }, include: { author: { select: { name: true } } } });
  await prisma.candidate.update({ where: { id }, data: { updatedAt: new Date() } });
  await audit(s, "NOTE", "Added a note", { candidateId: id });
  return Response.json(note, { status: 201 });
});
