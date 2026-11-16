// Demo data for the "Demo Recruiters" workspace: 3 clients with full details, and 16 candidates in the placement pipeline.
// Run on its own with `npm run db:demo-pipeline`. Safe to re-run: clients are upserted, and the pipeline is only filled once.
import { PrismaClient } from "@prisma/client";

const DAY = 86400000;
const today = () => new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
const d = (s: string) => new Date(`${s}T00:00:00Z`);
export const DEMO_CLIENTS = [
  {
    name: "Acme Fintech", industry: "BFSI", location: "Bengaluru", website: "acmefintech.example", gstin: "29AACCA1234F1Z5",
    contactName: "Neha Kapoor", contactTitle: "Head of Talent Acquisition", contactEmail: "neha.kapoor@acmefintech.example", contactPhone: "+91 98450 11223",
    feePercent: 8.33, billingAfterDays: null, guaranteeDays: null, agreementStart: d("2026-04-01"), agreementEnd: d("2027-03-31"), status: "Active",
    notes: "Hiring Java and frontend engineers for the payments team. Invoice to finance@acmefintech.example within 7 days of billing date.",
  },
  {
    name: "Nimbus Healthcare", industry: "Pharma / Healthcare", location: "Hyderabad", website: "nimbushealth.example", gstin: "36AAFCN5678K1Z2",
    contactName: "Arvind Rao", contactTitle: "HR Manager", contactEmail: "arvind.rao@nimbushealth.example", contactPhone: "+91 99080 44556",
    feePercent: 10, billingAfterDays: 30, guaranteeDays: 60, agreementStart: d("2026-07-15"), agreementEnd: null, status: "Active",
    notes: "Field sales and production roles across Telangana and AP. Shorter 60-day guarantee agreed.",
  },
  {
    name: "Orbit Retail", industry: "FMCG / Retail", location: "Mumbai", website: "orbitretail.example", gstin: "27AABCO9012M1Z8",
    contactName: "Sana Sheikh", contactTitle: "Talent Partner", contactEmail: "sana.sheikh@orbitretail.example", contactPhone: "+91 98200 77889",
    feePercent: 7.5, billingAfterDays: 45, guaranteeDays: 120, agreementStart: d("2026-01-10"), agreementEnd: d("2026-12-31"), status: "Active",
    notes: "Brand, category and store operations roles. Bills after 45 days; 120-day replacement guarantee.",
  },
];

/** Creates (or refreshes) the 3 demo clients and links demo candidates to them by name. */
export async function seedDemoClients(prisma: PrismaClient, tenantId: string) {
  const ids: string[] = [];
  for (const c of DEMO_CLIENTS) {
    const row = await prisma.client.upsert({ where: { tenantId_name: { tenantId, name: c.name } }, create: { ...c, tenantId }, update: c });
    ids.push(row.id);
    await prisma.candidate.updateMany({ where: { tenantId, clientName: c.name }, data: { clientId: row.id } });
  }
  // Older demo data used a fourth client; fold its candidates into the three demo clients.
  const old = await prisma.client.findFirst({ where: { tenantId, name: "Zenith Motors" } });
  const stray = await prisma.candidate.findMany({ where: { tenantId, OR: [{ clientName: "Zenith Motors" }, ...(old ? [{ clientId: old.id }] : [])] }, select: { id: true } });
  for (const [i, c] of stray.entries()) {
    await prisma.candidate.update({ where: { id: c.id }, data: { clientId: ids[i % 3], clientName: DEMO_CLIENTS[i % 3].name } });
  }
  if (old) await prisma.client.delete({ where: { id: old.id } });
  return ids;
}

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
  const clientIds = await seedDemoClients(prisma, admin.tenantId);
  console.log(`Demo clients ready: ${DEMO_CLIENTS.map((c) => c.name).join(", ")}.`);
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
        stage, stageUpdatedAt: new Date(Date.now() - (i % 5) * DAY), clientId: clientIds[i % 3], clientName: DEMO_CLIENTS[i % 3].name, jobTitle: c.currentTitle,
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
