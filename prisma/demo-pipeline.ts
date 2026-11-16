// Puts 16 demo candidates into the placement pipeline so the Pipeline page and timers have something to show.
// Run on its own with `npm run db:demo-pipeline` (only touches the "Demo Recruiters" workspace, and only once).
import { PrismaClient } from "@prisma/client";

const DAY = 86400000;
const today = () => new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
const clients = ["Acme Fintech", "Nimbus Healthcare", "Orbit Retail", "Zenith Motors"];

// [stage, joining date offset in days (negative = in the past), billed?]
const PLAN: [string, number | null, boolean][] = [
  ["INTERNAL", null, false], ["INTERNAL", null, false], ["INTERNAL", null, false],
  ["CLIENT", null, false], ["CLIENT", null, false], ["CLIENT", null, false],
  ["INTERVIEW", null, false], ["INTERVIEW", null, false],
  ["OFFER", 12, false], ["OFFER", 25, false],
  ["ONBOARDING", -4, false], ["ONBOARDING", -26, false], ["ONBOARDING", -33, false],
  ["BILLING", -45, true], ["BILLING", -81, true], ["BILLING", -120, true],
];

export async function seedDemoPipeline(prisma: PrismaClient) {
  const admin = await prisma.user.findUnique({ where: { email: "admin@demo.test" } });
  if (!admin) return console.log("Demo workspace not found; run npm run db:seed first.");
  if (await prisma.candidate.count({ where: { tenantId: admin.tenantId, stage: { not: null } } })) return console.log("Demo pipeline already has candidates; nothing changed.");
  const cands = await prisma.candidate.findMany({ where: { tenantId: admin.tenantId }, orderBy: { createdAt: "desc" }, take: PLAN.length, select: { id: true, currentTitle: true, currentCtc: true } });
  for (const [i, [stage, joinOffset, billed]] of PLAN.entries()) {
    const c = cands[i];
    if (!c) break;
    const joiningDate = joinOffset === null ? null : new Date(today().getTime() + joinOffset * DAY);
    const interviewAt = stage === "INTERVIEW" ? new Date(today().getTime() + (i - 5) * DAY + 5.5 * 3600000) : null; // 11:00 IST
    await prisma.candidate.update({
      where: { id: c.id },
      data: {
        stage, stageUpdatedAt: new Date(Date.now() - (i % 5) * DAY), clientName: clients[i % clients.length], jobTitle: c.currentTitle,
        interviewAt, joiningDate,
        offerCtc: joiningDate && c.currentCtc ? Math.round(c.currentCtc * 1.25 * 10) / 10 : null,
        billedOn: billed && joiningDate ? new Date(joiningDate.getTime() + 31 * DAY) : null,
        billingAmount: billed ? 85000 + i * 5000 : null,
        status: stage === "ONBOARDING" || stage === "BILLING" ? "Placed" : undefined,
      },
    });
    await prisma.stageEvent.create({ data: { tenantId: admin.tenantId, candidateId: c.id, userId: admin.id, fromStage: null, toStage: stage, note: "Demo data" } });
  }
  console.log(`Put ${Math.min(PLAN.length, cands.length)} demo candidates into the pipeline.`);
}

if (process.argv[1]?.endsWith("demo-pipeline.ts")) {
  const prisma = new PrismaClient();
  seedDemoPipeline(prisma).finally(() => prisma.$disconnect());
}
