import JSZip from "jszip";
import { prisma } from "./db";
import { saveFile } from "./storage";
import { extractResumeText, parseResumeText, RESUME_EXTENSIONS } from "./resume-parser";
import { findDuplicates, toCandidateData, type CandidateInput } from "./candidates";
import { audit } from "./audit";
import type { SessionPayload } from "./session";

export const MAX_RESUME_BYTES = 10 * 1024 * 1024;

export type ResumeResult = {
  fileName: string;
  status: "created" | "attached" | "failed";
  candidateId?: string;
  candidateName?: string;
  error?: string;
};

const mimeFor = (n: string) =>
  n.toLowerCase().endsWith(".pdf") ? "application/pdf"
  : n.toLowerCase().endsWith(".docx") ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  : "text/plain";

/** Expand uploaded files: ZIP archives are unpacked into their resume files. */
export async function expandUploads(files: { name: string; data: Buffer }[]) {
  const out: { name: string; data: Buffer }[] = [];
  for (const f of files) {
    if (f.name.toLowerCase().endsWith(".zip")) {
      const zip = await JSZip.loadAsync(f.data);
      for (const entry of Object.values(zip.files)) {
        const base = entry.name.split("/").pop() ?? entry.name;
        if (entry.dir || base.startsWith(".") || entry.name.includes("__MACOSX")) continue;
        out.push({ name: base, data: await entry.async("nodebuffer") });
      }
    } else out.push(f);
  }
  return out;
}

/**
 * Store a resume and parse it. If a candidate with the same email/phone exists, the resume is added
 * to that profile as a new version; otherwise a new candidate is created from the parsed fields.
 */
export async function ingestResume(
  s: SessionPayload,
  file: { name: string; data: Buffer },
  opts: { candidateId?: string; source?: string } = {},
): Promise<ResumeResult> {
  const fileName = file.name;
  try {
    if (!RESUME_EXTENSIONS.some((e) => fileName.toLowerCase().endsWith(e))) {
      throw new Error(fileName.toLowerCase().endsWith(".doc") ? "Old .doc files aren't supported yet. Save as DOCX or PDF." : "Unsupported file type (use PDF, DOCX or TXT)");
    }
    if (file.data.length > MAX_RESUME_BYTES) throw new Error("File is larger than 10 MB");
    const text = await extractResumeText(fileName, file.data);
    const parsed = parseResumeText(text, fileName);

    let candidateId = opts.candidateId;
    let status: ResumeResult["status"] = "attached";
    if (!candidateId) {
      const dup = await findDuplicates(s.tenantId, { email: parsed.email, phone: parsed.phone });
      candidateId = dup[0]?.id;
    }
    const storageKey = await saveFile(s.tenantId, fileName, file.data);

    let candidate;
    if (candidateId) {
      const existing = await prisma.candidate.findFirst({ where: { id: candidateId, tenantId: s.tenantId } });
      if (!existing) throw new Error("Candidate not found");
      const last = await prisma.resume.aggregate({ where: { candidateId }, _max: { version: true } });
      // Fill blanks from the new resume and add any new skills; never overwrite what a recruiter entered.
      const fill: Record<string, unknown> = {};
      const fillable = toCandidateData({
        email: parsed.email ?? undefined, phone: parsed.phone ?? undefined, linkedinUrl: parsed.linkedinUrl ?? undefined,
        location: parsed.location ?? undefined, totalExperience: parsed.totalExperience ?? undefined,
        noticePeriodDays: parsed.noticePeriodDays ?? undefined,
      } as CandidateInput);
      for (const [k, v] of Object.entries(fillable)) if (v !== null && (existing as Record<string, unknown>)[k] == null) fill[k] = v;
      candidate = await prisma.candidate.update({
        where: { id: candidateId },
        data: {
          ...fill,
          resumeText: text,
          skills: [...new Set([...existing.skills, ...parsed.skills])],
          resumes: {
            create: {
              tenantId: s.tenantId, version: (last._max.version ?? 0) + 1, fileName, mimeType: mimeFor(fileName),
              size: file.data.length, storageKey, text, uploadedById: s.userId,
            },
          },
        },
      });
    } else {
      status = "created";
      const data = toCandidateData({
        fullName: parsed.fullName ?? fileName.replace(/\.[^.]+$/, ""),
        email: parsed.email ?? undefined, phone: parsed.phone ?? undefined, linkedinUrl: parsed.linkedinUrl ?? undefined,
        location: parsed.location ?? undefined, totalExperience: parsed.totalExperience ?? undefined,
        noticePeriodDays: parsed.noticePeriodDays ?? undefined, skills: parsed.skills,
        source: opts.source ?? "Resume upload",
      } as CandidateInput);
      candidate = await prisma.candidate.create({
        data: {
          ...(data as { fullName: string }),
          tenantId: s.tenantId, ownerId: s.userId, createdById: s.userId, resumeText: text,
          resumes: {
            create: {
              tenantId: s.tenantId, version: 1, fileName, mimeType: mimeFor(fileName), size: file.data.length,
              storageKey, text, uploadedById: s.userId,
            },
          },
        },
      });
    }
    await audit(s, "RESUME_UPLOAD", status === "created" ? `Created from resume ${fileName}` : `Uploaded resume ${fileName}`, { candidateId: candidate.id });
    return { fileName, status, candidateId: candidate.id, candidateName: candidate.fullName };
  } catch (e) {
    return { fileName, status: "failed", error: e instanceof Error ? e.message : "Could not process file" };
  }
}

export type RowResult = { row: number; status: "created" | "updated" | "skipped" | "failed"; candidateId?: string; error?: string };

/** Import mapped spreadsheet rows. duplicateMode: skip, update (fill + overwrite mapped fields), or create anyway. */
export async function importRows(
  s: SessionPayload,
  rows: { row: number; data: CandidateInput }[],
  duplicateMode: "skip" | "update" | "create",
  defaults: { source?: string; tags?: string[] } = {},
): Promise<RowResult[]> {
  const results: RowResult[] = [];
  for (const { row, data: input } of rows) {
    try {
      const data = toCandidateData({ ...input, ownerId: undefined });
      if (!data.fullName && !data.email && !data.phone) throw new Error("Row has no name, email or phone");
      if (!data.fullName) data.fullName = (data.email as string)?.split("@")[0] ?? "Unknown";
      if (!data.source && defaults.source) data.source = defaults.source;
      if (defaults.tags?.length) data.tags = [...new Set([...((data.tags as string[]) ?? []), ...defaults.tags])];

      const dup = duplicateMode === "create" ? [] : await findDuplicates(s.tenantId, { email: data.email as string, phone: data.phone as string });
      if (dup.length && duplicateMode === "skip") {
        results.push({ row, status: "skipped", candidateId: dup[0].id, error: `Duplicate of ${dup[0].fullName}` });
        continue;
      }
      if (dup.length && duplicateMode === "update") {
        const existing = await prisma.candidate.findUniqueOrThrow({ where: { id: dup[0].id } });
        const upd: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(data)) if (v !== null && v !== undefined && !(Array.isArray(v) && !v.length)) upd[k] = v;
        if (upd.skills) upd.skills = [...new Set([...existing.skills, ...(upd.skills as string[])])];
        if (upd.tags) upd.tags = [...new Set([...existing.tags, ...(upd.tags as string[])])];
        await prisma.candidate.update({ where: { id: existing.id }, data: upd });
        results.push({ row, status: "updated", candidateId: existing.id });
        continue;
      }
      const c = await prisma.candidate.create({
        data: { ...(data as { fullName: string }), tenantId: s.tenantId, ownerId: s.userId, createdById: s.userId },
      });
      results.push({ row, status: "created", candidateId: c.id });
    } catch (e) {
      results.push({ row, status: "failed", error: e instanceof Error ? e.message.split("\n").pop() : "Failed" });
    }
  }
  return results;
}
