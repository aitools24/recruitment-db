import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError, handler, hashPassword, requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const GET = handler(async () => {
  const s = await requireApi("viewCandidates");
  const users = await prisma.user.findMany({ where: { tenantId: s.tenantId }, select: { id: true, name: true, email: true, role: true, active: true, createdAt: true }, orderBy: { createdAt: "asc" } });
  return Response.json({ users });
});

const body = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["ADMIN", "MANAGER", "RECRUITER", "VIEWER"]),
  password: z.string().min(8).max(200),
});

// Admin adds a team member with a temporary password.
export const POST = handler(async (req: Request) => {
  const s = await requireApi("manageUsers");
  const b = body.parse(await req.json());
  if (await prisma.user.findUnique({ where: { email: b.email } })) throw new HttpError(409, "A user with this email already exists");
  const u = await prisma.user.create({ data: { tenantId: s.tenantId, name: b.name, email: b.email, role: b.role, passwordHash: await hashPassword(b.password) } });
  await audit(s, "USER_CREATE", `Added user ${u.email} as ${u.role}`);
  return Response.json({ id: u.id }, { status: 201 });
});
