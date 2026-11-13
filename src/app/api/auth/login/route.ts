import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError, checkPassword, handler, startSession } from "@/lib/auth";

const body = z.object({ email: z.string().trim().toLowerCase(), password: z.string() });

export const POST = handler(async (req: Request) => {
  const b = body.parse(await req.json());
  const u = await prisma.user.findUnique({ where: { email: b.email } });
  if (!u || !(await checkPassword(b.password, u.passwordHash))) throw new HttpError(401, "Wrong email or password");
  if (!u.active) throw new HttpError(403, "This account has been deactivated");
  await startSession({ userId: u.id, tenantId: u.tenantId, role: u.role, name: u.name });
  await prisma.auditLog.create({ data: { tenantId: u.tenantId, userId: u.id, action: "LOGIN", message: "Signed in" } });
  return Response.json({ ok: true });
});
