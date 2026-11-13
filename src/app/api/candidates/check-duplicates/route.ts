import { handler, requireApi } from "@/lib/auth";
import { findDuplicates } from "@/lib/candidates";

export const GET = handler(async (req: Request) => {
  const s = await requireApi("viewCandidates");
  const sp = new URL(req.url).searchParams;
  const dups = await findDuplicates(s.tenantId, { email: sp.get("email"), phone: sp.get("phone"), excludeId: sp.get("excludeId") ?? undefined });
  return Response.json({ duplicates: dups });
});
