import { prisma } from "@/lib/db";
import { HttpError, handler, requireApi } from "@/lib/auth";
import { ingestResume } from "@/lib/ingest";

type Ctx = { params: Promise<{ id: string }> };

// Upload a new resume version to an existing candidate.
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireApi("editCandidates");
  const { id } = await params;
  if (!(await prisma.candidate.findFirst({ where: { id, tenantId: s.tenantId } }))) throw new HttpError(404, "Candidate not found");
  const file = (await req.formData()).get("file");
  if (!(file instanceof File)) throw new HttpError(400, "No file uploaded");
  const r = await ingestResume(s, { name: file.name, data: Buffer.from(await file.arrayBuffer()) }, { candidateId: id });
  if (r.status === "failed") throw new HttpError(400, r.error ?? "Upload failed");
  return Response.json(r, { status: 201 });
});
