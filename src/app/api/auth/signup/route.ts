import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError, handler, hashPassword, startSession } from "@/lib/auth";

const body = z.object({
  company: z.string().trim().min(2).max(100),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8).max(200),
});

// Creates a new workspace (tenant) with its first Admin user.
export const POST = handler(async (req: Request) => {
  const b = body.parse(await req.json());
  if (await prisma.user.findUnique({ where: { email: b.email } })) throw new HttpError(409, "An account with this email already exists");
  const tenant = await prisma.tenant.create({
    data: { name: b.company, users: { create: { email: b.email, name: b.name, passwordHash: await hashPassword(b.password), role: "ADMIN" } } },
    include: { users: true },
  });
  const u = tenant.users[0];
  await startSession({ userId: u.id, tenantId: tenant.id, role: u.role, name: u.name });
  return Response.json({ ok: true });
});
