import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import type { SessionPayload } from "./session";

export async function audit(
  s: SessionPayload,
  action: string,
  message: string,
  opts: { candidateId?: string | null; meta?: Prisma.InputJsonValue } = {},
) {
  await prisma.auditLog.create({
    data: { tenantId: s.tenantId, userId: s.userId, action, message, candidateId: opts.candidateId ?? null, meta: opts.meta },
  });
}
