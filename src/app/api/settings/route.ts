import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";

const body = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  exportRoles: z.array(z.enum(["ADMIN", "MANAGER", "RECRUITER", "VIEWER"])).optional(),
  exportMaxRows: z.number().int().min(1).max(100000).optional(),
  billingAfterDays: z.number().int().min(0).max(365).optional(),
  guaranteeDays: z.number().int().min(1).max(730).optional(),
});

export const PATCH = handler(async (req: Request) => {
  const s = await requireApi("manageSettings");
  const b = body.parse(await req.json());
  const exportRoles = b.exportRoles ? [...new Set(["ADMIN" as const, ...b.exportRoles])] : undefined; // Admin can always export
  const t = await prisma.tenant.update({ where: { id: s.tenantId }, data: { ...b, exportRoles } });
  await audit(s, "SETTINGS", "Updated workspace settings", { meta: { exportRoles: t.exportRoles, exportMaxRows: t.exportMaxRows, billingAfterDays: t.billingAfterDays, guaranteeDays: t.guaranteeDays } });
  return Response.json(t);
});
