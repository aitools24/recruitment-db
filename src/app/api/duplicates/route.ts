import { handler, requireApi } from "@/lib/auth";
import { duplicateGroups } from "@/lib/candidates";

export const GET = handler(async () => {
  const s = await requireApi("viewCandidates");
  return Response.json({ groups: await duplicateGroups(s.tenantId) });
});
