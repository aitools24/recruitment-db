import { prisma } from "./db";
import { INDUSTRIES, SOURCES, STATUSES } from "./normalize";

export async function formOptions(tenantId: string) {
  const [users, industries] = await Promise.all([
    prisma.user.findMany({ where: { tenantId, active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.candidate.findMany({ where: { tenantId, industry: { not: null } }, distinct: ["industry"], select: { industry: true } }),
  ]);
  return { users, industries: [...new Set([...INDUSTRIES, ...industries.map((i) => i.industry!)])].sort(), sources: SOURCES, statuses: STATUSES };
}
