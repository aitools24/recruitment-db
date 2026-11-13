import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError, handler, hashPassword, requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };
const body = z.object({
  role: z.enum(["ADMIN", "MANAGER", "RECRUITER", "VIEWER"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).max(200).optional(),
  name: z.string().trim().min(2).max(100).optional(),
});

export const PATCH = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireApi();
  const { id } = await params;
  const b = body.parse(await req.json());
  const self = id === s.userId;
  // Users may change their own name/password; everything else needs Admin.
  if (!(self && b.role === undefined && b.active === undefined) && s.role !== "ADMIN") throw new HttpError(403, "Only Admins can change users");
  const u = await prisma.user.findFirst({ where: { id, tenantId: s.tenantId } });
  if (!u) throw new HttpError(404, "User not found");
  if (self && (b.role && b.role !== "ADMIN" || b.active === false)) throw new HttpError(400, "You can't remove your own Admin access");
  await prisma.user.update({
    where: { id },
    data: { role: b.role, active: b.active, name: b.name, ...(b.password ? { passwordHash: await hashPassword(b.password) } : {}) },
  });
  const what = [b.role && `role → ${b.role}`, b.active !== undefined && (b.active ? "reactivated" : "deactivated"), b.password && "password reset", b.name && "name"].filter(Boolean).join(", ");
  await audit(s, "USER_UPDATE", `Updated user ${u.email}: ${what}`);
  return Response.json({ ok: true });
});
