import { prisma } from "@/lib/db";
import { HttpError, handler, requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { expandUploads, ingestResume, type ResumeResult } from "@/lib/ingest";

export const maxDuration = 300;

// Bulk resume upload: many PDF/DOCX/TXT files or ZIPs of them. The browser sends a few files per request.
export const POST = handler(async (req: Request) => {
  const s = await requireApi("importData");
  const form = await req.formData();
  const source = (form.get("source") as string | null) || undefined;
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) throw new HttpError(400, "No files uploaded");
  const expanded = await expandUploads(await Promise.all(files.map(async (f) => ({ name: f.name, data: Buffer.from(await f.arrayBuffer()) }))));
  if (expanded.length > 500) throw new HttpError(400, "Too many files in one upload (max 500)");
  const results: ResumeResult[] = [];
  for (const f of expanded) results.push(await ingestResume(s, f, { source }));
  const count = (st: string) => results.filter((r) => r.status === st).length;
  const job = await prisma.importJob.create({
    data: {
      tenantId: s.tenantId, userId: s.userId, kind: "RESUMES", fileName: files.map((f) => f.name).join(", ").slice(0, 300),
      total: results.length, created: count("created"), updated: count("attached"), failed: count("failed"),
      errors: results.filter((r) => r.status === "failed").map((r) => ({ file: r.fileName, error: r.error })),
    },
  });
  await audit(s, "IMPORT", `Uploaded ${results.length} resume(s): ${count("created")} new, ${count("attached")} added to existing, ${count("failed")} failed`, { meta: { jobId: job.id } });
  return Response.json({ results });
});
