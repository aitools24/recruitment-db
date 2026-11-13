import { prisma } from "./db";

type Row = { label: string; value: number; href?: string };

const n = (v: unknown) => Number(v ?? 0);

/** Everything the dashboard shows, scoped to one tenant. */
export async function dashboardData(tenantId: string) {
  const [totals] = await prisma.$queryRaw<Record<string, bigint | number | null>[]>`
    SELECT count(*) AS total,
           count(*) FILTER (WHERE "createdAt" >= now() - interval '7 days') AS week,
           count(*) FILTER (WHERE "createdAt" >= now() - interval '30 days') AS month,
           count(*) FILTER (WHERE "createdAt" >= now() - interval '60 days' AND "createdAt" < now() - interval '30 days') AS prev_month,
           count(*) FILTER (WHERE status = 'Active') AS active,
           count(*) FILTER (WHERE "noticePeriodDays" <= 15) AS quick_join,
           count(*) FILTER (WHERE "resumeText" IS NOT NULL) AS with_resume,
           round(avg("totalExperience")::numeric, 1) AS avg_exp
      FROM "Candidate" WHERE "tenantId" = ${tenantId}`;

  const weekly = await prisma.$queryRaw<{ week: Date; count: bigint }[]>`
    SELECT w.week, count(c.id) AS count
      FROM generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') AS w(week)
      LEFT JOIN "Candidate" c ON c."tenantId" = ${tenantId} AND date_trunc('week', c."createdAt") = w.week
     GROUP BY w.week ORDER BY w.week`;

  const industry = await prisma.$queryRaw<{ label: string | null; value: bigint }[]>`
    SELECT industry AS label, count(*) AS value FROM "Candidate" WHERE "tenantId" = ${tenantId}
     GROUP BY industry ORDER BY count(*) DESC`;

  const skills = await prisma.$queryRaw<{ label: string; value: bigint }[]>`
    SELECT s AS label, count(*) AS value FROM "Candidate", unnest(skills) AS s WHERE "tenantId" = ${tenantId}
     GROUP BY s ORDER BY count(*) DESC, s LIMIT 10`;

  const source = await prisma.$queryRaw<{ label: string | null; value: bigint }[]>`
    SELECT source AS label, count(*) AS value FROM "Candidate" WHERE "tenantId" = ${tenantId}
     GROUP BY source ORDER BY count(*) DESC`;

  const owners = await prisma.$queryRaw<{ id: string | null; label: string | null; value: bigint; month: bigint }[]>`
    SELECT u.id, u.name AS label, count(c.id) AS value,
           count(c.id) FILTER (WHERE c."createdAt" >= now() - interval '30 days') AS month
      FROM "Candidate" c LEFT JOIN "User" u ON u.id = c."ownerId"
     WHERE c."tenantId" = ${tenantId} GROUP BY u.id, u.name ORDER BY count(c.id) DESC LIMIT 8`;

  const [notice] = await prisma.$queryRaw<Record<string, bigint>[]>`
    SELECT count(*) FILTER (WHERE "noticePeriodDays" = 0) AS "Immediate",
           count(*) FILTER (WHERE "noticePeriodDays" BETWEEN 1 AND 15) AS "1–15 days",
           count(*) FILTER (WHERE "noticePeriodDays" BETWEEN 16 AND 30) AS "16–30 days",
           count(*) FILTER (WHERE "noticePeriodDays" BETWEEN 31 AND 60) AS "31–60 days",
           count(*) FILTER (WHERE "noticePeriodDays" BETWEEN 61 AND 90) AS "61–90 days",
           count(*) FILTER (WHERE "noticePeriodDays" > 90) AS "90+ days",
           count(*) FILTER (WHERE "noticePeriodDays" IS NULL) AS "Not known"
      FROM "Candidate" WHERE "tenantId" = ${tenantId}`;

  const [exp] = await prisma.$queryRaw<Record<string, bigint>[]>`
    SELECT count(*) FILTER (WHERE "totalExperience" < 2) AS "0–2 yrs",
           count(*) FILTER (WHERE "totalExperience" >= 2 AND "totalExperience" < 5) AS "2–5 yrs",
           count(*) FILTER (WHERE "totalExperience" >= 5 AND "totalExperience" < 8) AS "5–8 yrs",
           count(*) FILTER (WHERE "totalExperience" >= 8 AND "totalExperience" < 12) AS "8–12 yrs",
           count(*) FILTER (WHERE "totalExperience" >= 12) AS "12+ yrs",
           count(*) FILTER (WHERE "totalExperience" IS NULL) AS "Not known"
      FROM "Candidate" WHERE "tenantId" = ${tenantId}`;

  const [dups] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*) FROM (
      SELECT 1 FROM "Candidate" WHERE "tenantId" = ${tenantId} AND "emailLower" IS NOT NULL GROUP BY "emailLower" HAVING count(*) > 1
      UNION ALL
      SELECT 1 FROM "Candidate" WHERE "tenantId" = ${tenantId} AND "phoneNormalized" IS NOT NULL GROUP BY "phoneNormalized" HAVING count(*) > 1
    ) d`;

  const [recentImports, recentActivity] = await Promise.all([
    prisma.importJob.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.auditLog.findMany({
      where: { tenantId, action: { notIn: ["VIEW", "LOGIN"] } },
      orderBy: { createdAt: "desc" }, take: 8,
      include: { user: { select: { name: true } }, candidate: { select: { id: true, fullName: true } } },
    }),
  ]);

  const q = (k: string, v: string) => `/candidates?${new URLSearchParams({ [k]: v })}`;
  const nr = (min: number, max?: number) => `/candidates?${new URLSearchParams({ noticeMin: String(min), ...(max !== undefined ? { noticeMax: String(max) } : {}) })}`;
  const noticeHref: Record<string, string> = { Immediate: nr(0, 0), "1–15 days": nr(1, 15), "16–30 days": nr(16, 30), "31–60 days": nr(31, 60), "61–90 days": nr(61, 90), "90+ days": nr(91) };
  const expRange: Record<string, [string, string?]> = { "0–2 yrs": ["0", "1.9"], "2–5 yrs": ["2", "4.9"], "5–8 yrs": ["5", "7.9"], "8–12 yrs": ["8", "11.9"], "12+ yrs": ["12"] };

  // Industry: top 7, the rest folded into "Other industries".
  const ind: Row[] = industry.slice(0, 7).map((r) => ({ label: r.label ?? "Not set", value: n(r.value), href: r.label ? q("industry", r.label) : undefined }));
  const indRest = industry.slice(7).reduce((s, r) => s + n(r.value), 0);
  if (indRest) ind.push({ label: "Other industries", value: indRest });

  return {
    totals: {
      total: n(totals.total), week: n(totals.week), month: n(totals.month), prevMonth: n(totals.prev_month),
      active: n(totals.active), quickJoin: n(totals.quick_join), withResume: n(totals.with_resume),
      avgExp: totals.avg_exp === null ? null : Number(totals.avg_exp), duplicates: n(dups.count),
    },
    weekly: weekly.map((w) => ({ week: w.week, value: n(w.count) })),
    industry: ind,
    skills: skills.map((r) => ({ label: r.label, value: n(r.value), href: q("skills", r.label) })),
    source: source.map((r) => ({ label: r.label ?? "Not set", value: n(r.value), href: r.label ? q("source", r.label) : undefined })),
    owners: owners.map((r) => ({ label: r.label ?? "Unassigned", value: n(r.value), month: n(r.month), href: r.id ? q("ownerId", r.id) : undefined })),
    notice: Object.entries(notice).map(([label, v]) => ({ label, value: n(v), href: noticeHref[label] })).filter((r) => r.value || r.label !== "Not known"),
    experience: Object.entries(exp).map(([label, v]) => {
      const r = expRange[label];
      return { label, value: n(v), href: r ? `/candidates?${new URLSearchParams({ expMin: r[0], ...(r[1] ? { expMax: r[1] } : {}) })}` : undefined };
    }).filter((r) => r.value || r.label !== "Not known"),
    recentImports,
    recentActivity,
  };
}
