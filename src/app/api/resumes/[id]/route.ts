import { prisma } from "@/lib/db";
import { HttpError, handler, requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { readFile } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireApi("downloadResumes");
  const r = await prisma.resume.findFirst({ where: { id: (await params).id, tenantId: s.tenantId } });
  if (!r) throw new HttpError(404, "Resume not found");
  const data = await readFile(r.storageKey);
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  await audit(s, "RESUME_DOWNLOAD", `${inline ? "Viewed" : "Downloaded"} resume ${r.fileName}`, { candidateId: r.candidateId });
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": r.mimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(r.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
