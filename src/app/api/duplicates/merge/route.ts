import { z } from "zod";
import { handler, requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { mergeCandidates } from "@/lib/candidates";
import { prisma } from "@/lib/db";

const body = z.object({ primaryId: z.string(), otherIds: z.array(z.string()).min(1).max(20) });

export const POST = handler(async (req: Request) => {
  const s = await requireApi("mergeDuplicates");
  const b = body.parse(await req.json());
  const others = await prisma.candidate.findMany({ where: { tenantId: s.tenantId, id: { in: b.otherIds } }, select: { fullName: true, email: true, phone: true } });
  const merged = await mergeCandidates(s.tenantId, b.primaryId, b.otherIds.filter((id) => id !== b.primaryId));
  await audit(s, "MERGE", `Merged ${others.length} duplicate profile(s) into this one`, { candidateId: merged.id, meta: { merged: others } });
  return Response.json({ ok: true, id: merged.id });
});
