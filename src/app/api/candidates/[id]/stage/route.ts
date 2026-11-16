import { z } from "zod";
import { prisma } from "@/lib/db";
import { HttpError, handler, requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { STAGE_KEYS, stageIndex, stageInfo, todayIST } from "@/lib/pipeline";

type Ctx = { params: Promise<{ id: string }> };

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-01").transform((s) => new Date(`${s}T00:00:00Z`));
const text = z.string().trim().max(200).transform((s) => s || null);
const body = z.object({
  stage: z.enum(STAGE_KEYS).nullable().optional(),
  note: z.string().trim().max(2000).optional(),
  clientName: text.nullable().optional(),
  jobTitle: text.nullable().optional(),
  // datetime-local value from the browser, entered in India time
  interviewAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).transform((s) => new Date(`${s}:00+05:30`)).nullable().optional(),
  offerCtc: z.number().min(0).max(10000).nullable().optional(),
  joiningDate: date.nullable().optional(),
  billedOn: date.nullable().optional(),
  billingAmount: z.number().min(0).max(1e9).nullable().optional(),
});

/** Move a candidate to a pipeline stage and/or update the placement details. */
export const POST = handler(async (req: Request, { params }: Ctx) => {
  const s = await requireApi("editCandidates");
  const { id } = await params;
  const b = body.parse(await req.json());
  const c = await prisma.candidate.findFirst({ where: { id, tenantId: s.tenantId } });
  if (!c) throw new HttpError(404, "Candidate not found");

  const { stage, note, ...details } = b;
  const next = stage === undefined ? c.stage : stage;
  const moved = next !== c.stage;
  const joiningDate = details.joiningDate !== undefined ? details.joiningDate : c.joiningDate;
  if (next && stageIndex(next) >= stageIndex("ONBOARDING") && !joiningDate) throw new HttpError(400, "Enter the joining date to move to Onboarding or Billing");
  if ((next === "CLIENT" || stageIndex(next) > stageIndex("CLIENT")) && !(details.clientName ?? c.clientName)) throw new HttpError(400, "Enter the client name");

  const data: Record<string, unknown> = { ...details };
  if (moved) {
    data.stage = next;
    data.stageUpdatedAt = new Date();
    if (next === "BILLING" && details.billedOn === undefined && !c.billedOn) data.billedOn = todayIST();
    if (next === "ONBOARDING" || next === "BILLING") data.status = "Placed";
  }

  const [updated] = await prisma.$transaction([
    prisma.candidate.update({ where: { id }, data }),
    ...(moved || note ? [prisma.stageEvent.create({ data: { tenantId: s.tenantId, candidateId: id, userId: s.userId, fromStage: c.stage, toStage: next, note: note || null } })] : []),
  ]);
  const msg = moved
    ? next ? `Moved to ${stageInfo(next)!.label}${updated.clientName ? ` (${updated.clientName})` : ""}` : "Removed from pipeline"
    : "Updated placement details";
  await audit(s, "STAGE", msg, { candidateId: id, meta: { from: c.stage, to: next } });
  return Response.json(updated);
});
