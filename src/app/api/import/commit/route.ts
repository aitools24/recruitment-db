import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { candidateInput } from "@/lib/candidates";
import { importRows } from "@/lib/ingest";

const body = z.object({
  jobId: z.string().optional(), // send back on later chunks so one file = one import record
  fileName: z.string().max(300),
  duplicateMode: z.enum(["skip", "update", "create"]),
  source: z.string().max(60).optional(),
  tags: z.array(z.string().max(60)).max(20).optional(),
  rows: z.array(z.object({ row: z.number(), data: candidateInput })).max(500),
  totalRows: z.number().optional(),
});

// Step 2: the browser sends mapped rows in chunks of up to 500.
export const POST = handler(async (req: Request) => {
  const s = await requireApi("importData");
  const b = body.parse(await req.json());
  const results = await importRows(s, b.rows, b.duplicateMode, { source: b.source, tags: b.tags?.map((t) => t.toLowerCase()) });
  const count = (st: string) => results.filter((r) => r.status === st).length;
  const errors = results.filter((r) => r.status === "failed" || r.status === "skipped").map((r) => ({ row: r.row, status: r.status, error: r.error }));

  let job = b.jobId ? await prisma.importJob.findFirst({ where: { id: b.jobId, tenantId: s.tenantId } }) : null;
  if (job) {
    job = await prisma.importJob.update({
      where: { id: job.id },
      data: {
        created: { increment: count("created") }, updated: { increment: count("updated") },
        skipped: { increment: count("skipped") }, failed: { increment: count("failed") },
        errors: [...((job.errors as object[]) ?? []), ...errors].slice(0, 5000) as object[],
      },
    });
  } else {
    job = await prisma.importJob.create({
      data: {
        tenantId: s.tenantId, userId: s.userId, kind: "SPREADSHEET", fileName: b.fileName, total: b.totalRows ?? b.rows.length,
        created: count("created"), updated: count("updated"), skipped: count("skipped"), failed: count("failed"), errors,
      },
    });
    await audit(s, "IMPORT", `Started spreadsheet import of ${b.fileName} (${b.totalRows ?? b.rows.length} rows)`, { meta: { jobId: job.id } });
  }
  return Response.json({ jobId: job.id, results });
});
