import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./db";
import {
  clean, normalizeEmail, normalizePhone, parseCtc, parseExperience, parseNotice, toList,
} from "./normalize";

// ---------- Input ----------

/** Loose input accepted from forms, spreadsheets and the resume parser. Values are normalised by toCandidateData. */
export const candidateInput = z.object({
  fullName: z.any().optional(),
  email: z.any().optional(),
  phone: z.any().optional(),
  altPhone: z.any().optional(),
  location: z.any().optional(),
  linkedinUrl: z.any().optional(),
  currentCompany: z.any().optional(),
  currentTitle: z.any().optional(),
  industry: z.any().optional(),
  functionalArea: z.any().optional(),
  totalExperience: z.any().optional(),
  currentCtc: z.any().optional(),
  expectedCtc: z.any().optional(),
  noticePeriodDays: z.any().optional(),
  highestDegree: z.any().optional(),
  college: z.any().optional(),
  education: z.any().optional(),
  certifications: z.any().optional(),
  languages: z.any().optional(),
  skills: z.any().optional(),
  tags: z.any().optional(),
  source: z.any().optional(),
  status: z.any().optional(),
  ownerId: z.any().optional(),
});
export type CandidateInput = z.infer<typeof candidateInput>;

export const CANDIDATE_FIELDS: { key: keyof CandidateInput; label: string }[] = [
  { key: "fullName", label: "Full name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "altPhone", label: "Alternate phone" },
  { key: "location", label: "Location" },
  { key: "linkedinUrl", label: "LinkedIn URL" },
  { key: "currentCompany", label: "Current company" },
  { key: "currentTitle", label: "Current designation" },
  { key: "industry", label: "Industry" },
  { key: "functionalArea", label: "Functional area" },
  { key: "totalExperience", label: "Total experience (years)" },
  { key: "currentCtc", label: "Current CTC (LPA)" },
  { key: "expectedCtc", label: "Expected CTC (LPA)" },
  { key: "noticePeriodDays", label: "Notice period" },
  { key: "highestDegree", label: "Highest degree" },
  { key: "college", label: "College / University" },
  { key: "education", label: "Education details" },
  { key: "certifications", label: "Certifications" },
  { key: "languages", label: "Languages" },
  { key: "skills", label: "Skills (comma separated)" },
  { key: "tags", label: "Tags (comma separated)" },
  { key: "source", label: "Source" },
  { key: "status", label: "Status" },
];

/** Normalise loose input into DB fields. Only keys present in `input` are returned (so it works for partial updates). */
export function toCandidateData(input: CandidateInput) {
  const d: Record<string, unknown> = {};
  const has = (k: keyof CandidateInput) => Object.prototype.hasOwnProperty.call(input, k) && input[k] !== undefined;
  const text = ["fullName", "altPhone", "location", "linkedinUrl", "currentCompany", "currentTitle", "industry",
    "functionalArea", "highestDegree", "college", "education", "certifications", "languages", "source"] as const;
  for (const k of text) if (has(k)) d[k] = clean(input[k]);
  if (has("email")) {
    d.email = normalizeEmail(input.email) ?? clean(input.email);
    d.emailLower = normalizeEmail(input.email);
  }
  if (has("phone")) {
    d.phone = clean(input.phone);
    d.phoneNormalized = normalizePhone(input.phone);
  }
  if (has("totalExperience")) d.totalExperience = typeof input.totalExperience === "number" ? input.totalExperience : parseExperience(input.totalExperience);
  if (has("currentCtc")) d.currentCtc = typeof input.currentCtc === "number" ? input.currentCtc : parseCtc(input.currentCtc);
  if (has("expectedCtc")) d.expectedCtc = typeof input.expectedCtc === "number" ? input.expectedCtc : parseCtc(input.expectedCtc);
  if (has("noticePeriodDays")) d.noticePeriodDays = typeof input.noticePeriodDays === "number" ? input.noticePeriodDays : parseNotice(input.noticePeriodDays);
  if (has("skills")) d.skills = toList(input.skills);
  if (has("tags")) d.tags = toList(input.tags);
  if (has("status")) d.status = clean(input.status) ?? "Active";
  if (has("ownerId")) d.ownerId = clean(input.ownerId);
  return d;
}

// ---------- Duplicates ----------

export async function findDuplicates(tenantId: string, opts: { email?: string | null; phone?: string | null; excludeId?: string }) {
  const email = normalizeEmail(opts.email);
  const phone = normalizePhone(opts.phone);
  const or: Prisma.CandidateWhereInput[] = [];
  if (email) or.push({ emailLower: email });
  if (phone) or.push({ phoneNormalized: phone });
  if (!or.length) return [];
  return prisma.candidate.findMany({
    where: { tenantId, OR: or, ...(opts.excludeId ? { id: { not: opts.excludeId } } : {}) },
    select: { id: true, fullName: true, email: true, phone: true, currentCompany: true, currentTitle: true, updatedAt: true },
    take: 5,
  });
}

/** Groups of candidates sharing an email or phone within a tenant. */
export async function duplicateGroups(tenantId: string) {
  const rows = await prisma.$queryRaw<{ key: string; kind: string; ids: string[] }[]>`
    SELECT "emailLower" AS key, 'email' AS kind, array_agg(id ORDER BY "createdAt") AS ids
      FROM "Candidate" WHERE "tenantId" = ${tenantId} AND "emailLower" IS NOT NULL
      GROUP BY "emailLower" HAVING count(*) > 1
    UNION ALL
    SELECT "phoneNormalized", 'phone', array_agg(id ORDER BY "createdAt")
      FROM "Candidate" WHERE "tenantId" = ${tenantId} AND "phoneNormalized" IS NOT NULL
      GROUP BY "phoneNormalized" HAVING count(*) > 1
    LIMIT 200`;
  // Collapse groups that contain the same set of people (matched on both email and phone).
  const seen = new Set<string>();
  const groups = rows.filter((r) => {
    const sig = [...r.ids].sort().join(",");
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
  const ids = [...new Set(groups.flatMap((g) => g.ids))];
  const people = await prisma.candidate.findMany({
    where: { tenantId, id: { in: ids } },
    include: { owner: { select: { name: true } }, _count: { select: { resumes: true, notes: true } } },
  });
  const byId = new Map(people.map((p) => [p.id, p]));
  return groups.map((g) => ({ ...g, candidates: g.ids.map((id) => byId.get(id)).filter((c) => !!c) }));
}

const MERGE_SCALARS = ["email", "emailLower", "phone", "phoneNormalized", "altPhone", "location", "linkedinUrl",
  "currentCompany", "currentTitle", "industry", "functionalArea", "totalExperience", "currentCtc", "expectedCtc",
  "noticePeriodDays", "highestDegree", "college", "education", "certifications", "languages", "source", "ownerId",
  "resumeText"] as const;

/** Merge `otherIds` into `primaryId`: fill blank fields, union skills/tags, move resumes, notes and activity, then delete the others. */
export async function mergeCandidates(tenantId: string, primaryId: string, otherIds: string[]) {
  return prisma.$transaction(async (tx) => {
    const all = await tx.candidate.findMany({ where: { tenantId, id: { in: [primaryId, ...otherIds] } } });
    const primary = all.find((c) => c.id === primaryId);
    const others = all.filter((c) => c.id !== primaryId);
    if (!primary || others.length !== otherIds.length) throw new Error("Candidates not found");
    const data: Record<string, unknown> = {};
    for (const k of MERGE_SCALARS) {
      if (primary[k] === null || primary[k] === undefined) {
        const v = others.find((o) => o[k] !== null && o[k] !== undefined)?.[k];
        if (v !== undefined) data[k] = v;
      }
    }
    data.skills = [...new Set([...primary.skills, ...others.flatMap((o) => o.skills)])];
    data.tags = [...new Set([...primary.tags, ...others.flatMap((o) => o.tags)])];
    const maxVersion = await tx.resume.aggregate({ where: { candidateId: primaryId }, _max: { version: true } });
    let v = maxVersion._max.version ?? 0;
    const moving = await tx.resume.findMany({ where: { candidateId: { in: otherIds } }, orderBy: { createdAt: "asc" } });
    for (const r of moving) await tx.resume.update({ where: { id: r.id }, data: { candidateId: primaryId, version: ++v } });
    await tx.note.updateMany({ where: { candidateId: { in: otherIds } }, data: { candidateId: primaryId } });
    await tx.auditLog.updateMany({ where: { candidateId: { in: otherIds } }, data: { candidateId: primaryId } });
    await tx.candidate.deleteMany({ where: { tenantId, id: { in: otherIds } } });
    return tx.candidate.update({ where: { id: primaryId }, data });
  });
}

// ---------- Search ----------

export type SearchParams = {
  q?: string;
  industry?: string[];
  skills?: string[];
  skillsMode?: "all" | "any";
  tags?: string[];
  expMin?: number; expMax?: number;
  ctcMin?: number; ctcMax?: number;
  noticeMax?: number;
  location?: string;
  company?: string;
  title?: string;
  degree?: string;
  source?: string[];
  status?: string[];
  ownerId?: string;
  addedFrom?: string; addedTo?: string;
  sort?: "relevance" | "newest" | "updated" | "experience" | "name";
  page?: number; pageSize?: number;
};

export function parseSearchParams(sp: URLSearchParams): SearchParams {
  const list = (k: string) => sp.getAll(k).flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
  const num = (k: string) => {
    const v = sp.get(k);
    if (v === null || v === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const str = (k: string) => sp.get(k)?.trim() || undefined;
  return {
    q: str("q"),
    industry: list("industry"),
    skills: list("skills").map((s) => s.toLowerCase()),
    skillsMode: sp.get("skillsMode") === "any" ? "any" : "all",
    tags: list("tags").map((s) => s.toLowerCase()),
    expMin: num("expMin"), expMax: num("expMax"),
    ctcMin: num("ctcMin"), ctcMax: num("ctcMax"),
    noticeMax: num("noticeMax"),
    location: str("location"), company: str("company"), title: str("title"), degree: str("degree"),
    source: list("source"), status: list("status"),
    ownerId: str("ownerId"),
    addedFrom: str("addedFrom"), addedTo: str("addedTo"),
    sort: (str("sort") as SearchParams["sort"]) || undefined,
    page: num("page"), pageSize: num("pageSize"),
  };
}

const like = (s: string) => `%${s.replace(/[%_\\]/g, (c) => "\\" + c)}%`;

function whereSql(tenantId: string, p: SearchParams) {
  const w: Prisma.Sql[] = [Prisma.sql`c."tenantId" = ${tenantId}`];
  if (p.q) {
    const phone = /\d{6,}/.test(p.q.replace(/\D/g, "")) && !/[a-z]/i.test(p.q) ? normalizePhone(p.q) : null;
    w.push(Prisma.sql`(c."searchVector" @@ websearch_to_tsquery('english', ${p.q})
      OR c."fullName" ILIKE ${like(p.q)}
      ${p.q.length >= 4 && !/["()-]|\bor\b/i.test(p.q) ? Prisma.sql`OR c."fullName" % ${p.q}` : Prisma.empty}
      OR c."emailLower" = ${p.q.toLowerCase()}
      ${phone ? Prisma.sql`OR c."phoneNormalized" = ${phone}` : Prisma.empty})`);
  }
  if (p.industry?.length) w.push(Prisma.sql`c."industry" IN (${Prisma.join(p.industry)})`);
  if (p.skills?.length) {
    w.push(p.skillsMode === "any"
      ? Prisma.sql`c."skills" && ${p.skills}::text[]`
      : Prisma.sql`c."skills" @> ${p.skills}::text[]`);
  }
  if (p.tags?.length) w.push(Prisma.sql`c."tags" @> ${p.tags}::text[]`);
  if (p.expMin !== undefined) w.push(Prisma.sql`c."totalExperience" >= ${p.expMin}`);
  if (p.expMax !== undefined) w.push(Prisma.sql`c."totalExperience" <= ${p.expMax}`);
  if (p.ctcMin !== undefined) w.push(Prisma.sql`c."currentCtc" >= ${p.ctcMin}`);
  if (p.ctcMax !== undefined) w.push(Prisma.sql`c."currentCtc" <= ${p.ctcMax}`);
  if (p.noticeMax !== undefined) w.push(Prisma.sql`c."noticePeriodDays" <= ${p.noticeMax}`);
  if (p.location) w.push(Prisma.sql`c."location" ILIKE ${like(p.location)}`);
  if (p.company) w.push(Prisma.sql`c."currentCompany" ILIKE ${like(p.company)}`);
  if (p.title) w.push(Prisma.sql`c."currentTitle" ILIKE ${like(p.title)}`);
  if (p.degree) w.push(Prisma.sql`(c."highestDegree" ILIKE ${like(p.degree)} OR c."education" ILIKE ${like(p.degree)})`);
  if (p.source?.length) w.push(Prisma.sql`c."source" IN (${Prisma.join(p.source)})`);
  if (p.status?.length) w.push(Prisma.sql`c."status" IN (${Prisma.join(p.status)})`);
  if (p.ownerId) w.push(Prisma.sql`c."ownerId" = ${p.ownerId}`);
  if (p.addedFrom) w.push(Prisma.sql`c."createdAt" >= ${new Date(p.addedFrom)}`);
  if (p.addedTo) w.push(Prisma.sql`c."createdAt" < ${new Date(new Date(p.addedTo).getTime() + 86400000)}`);
  return Prisma.join(w, " AND ");
}

function orderSql(p: SearchParams) {
  const sort = p.sort ?? (p.q ? "relevance" : "newest");
  switch (sort) {
    case "relevance":
      return p.q
        ? Prisma.sql`ts_rank(c."searchVector", websearch_to_tsquery('english', ${p.q})) + similarity(c."fullName", ${p.q}) DESC, c."updatedAt" DESC`
        : Prisma.sql`c."updatedAt" DESC`;
    case "updated": return Prisma.sql`c."updatedAt" DESC`;
    case "experience": return Prisma.sql`c."totalExperience" DESC NULLS LAST`;
    case "name": return Prisma.sql`c."fullName" ASC`;
    default: return Prisma.sql`c."createdAt" DESC`;
  }
}

export type SearchRow = {
  id: string; fullName: string; email: string | null; phone: string | null; location: string | null;
  currentCompany: string | null; currentTitle: string | null; industry: string | null;
  totalExperience: number | null; currentCtc: number | null; expectedCtc: number | null; noticePeriodDays: number | null;
  skills: string[]; tags: string[]; source: string | null; status: string; ownerName: string | null;
  createdAt: Date; updatedAt: Date; snippet: string | null;
};

export async function searchCandidates(tenantId: string, p: SearchParams) {
  const pageSize = Math.min(Math.max(p.pageSize ?? 25, 1), 100);
  const page = Math.max(p.page ?? 1, 1);
  const where = whereSql(tenantId, p);
  const [{ count }] = await prisma.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM "Candidate" c WHERE ${where}`;
  const snippet = p.q
    ? Prisma.sql`NULLIF(ts_headline('english', coalesce(c."resumeText", ''), websearch_to_tsquery('english', ${p.q}),
        'StartSel=[[[, StopSel=]]], MaxFragments=2, MaxWords=18, MinWords=6, FragmentDelimiter= … '), '')`
    : Prisma.sql`NULL`;
  const rows = await prisma.$queryRaw<SearchRow[]>`
    WITH page AS (
      SELECT c.id FROM "Candidate" c WHERE ${where} ORDER BY ${orderSql(p)} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
    )
    SELECT c.id, c."fullName", c.email, c.phone, c.location, c."currentCompany", c."currentTitle", c.industry,
           c."totalExperience", c."currentCtc", c."expectedCtc", c."noticePeriodDays", c.skills, c.tags, c.source, c.status,
           u.name AS "ownerName", c."createdAt", c."updatedAt",
           CASE WHEN ${snippet} LIKE '%[[[%' THEN ${snippet} ELSE NULL END AS snippet
      FROM page JOIN "Candidate" c ON c.id = page.id LEFT JOIN "User" u ON u.id = c."ownerId"
      ORDER BY ${orderSql(p)}`;
  return { rows, total: Number(count), page, pageSize };
}

/** Rows for export (no pagination, capped). */
export async function exportCandidates(tenantId: string, p: SearchParams, limit: number) {
  return prisma.$queryRaw<(SearchRow & Record<string, unknown>)[]>`
    SELECT c."fullName", c.email, c.phone, c."altPhone", c.location, c."currentCompany", c."currentTitle", c.industry,
           c."functionalArea", c."totalExperience", c."currentCtc", c."expectedCtc", c."noticePeriodDays",
           c."highestDegree", c.college, c.certifications, c.languages,
           array_to_string(c.skills, ', ') AS skills, array_to_string(c.tags, ', ') AS tags,
           c.source, c.status, u.name AS "ownerName", c."linkedinUrl", c."createdAt", c."updatedAt"
      FROM "Candidate" c LEFT JOIN "User" u ON u.id = c."ownerId"
     WHERE ${whereSql(tenantId, p)} ORDER BY ${orderSql(p)} LIMIT ${limit}`;
}
