import ExcelJS from "exceljs";
import Papa from "papaparse";
import { CANDIDATE_FIELDS } from "./candidates";

export const MAX_IMPORT_ROWS = 20000;

/** Parse CSV/XLSX into header + row arrays (strings). */
export async function parseSpreadsheet(fileName: string, data: Buffer): Promise<{ headers: string[]; rows: string[][] }> {
  const lower = fileName.toLowerCase();
  let grid: string[][];
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
    const res = Papa.parse<string[]>(data.toString("utf8").replace(/^﻿/, ""), { skipEmptyLines: true });
    grid = res.data.map((r) => r.map((c) => String(c ?? "").trim()));
  } else if (lower.endsWith(".xlsx")) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(data as unknown as ArrayBuffer);
    const ws = wb.worksheets.find((w) => w.rowCount > 0);
    if (!ws) return { headers: [], rows: [] };
    grid = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals: string[] = [];
      for (let i = 1; i <= ws.columnCount; i++) vals.push(cellText(row.getCell(i).value));
      grid.push(vals);
    });
  } else {
    throw new Error(lower.endsWith(".xls") ? "Old .xls files aren't supported. Save the sheet as .xlsx or .csv." : "Upload a .csv or .xlsx file");
  }
  // Header = first row with at least 2 non-empty cells (skips title rows in exported reports).
  const hIdx = grid.findIndex((r) => r.filter(Boolean).length >= 2);
  if (hIdx < 0) return { headers: [], rows: [] };
  const headers = grid[hIdx].map((h, i) => h || `Column ${i + 1}`);
  const rows = grid.slice(hIdx + 1).filter((r) => r.some((c) => c)).slice(0, MAX_IMPORT_ROWS);
  return { headers, rows: rows.map((r) => headers.map((_, i) => r[i] ?? "")) };
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("text" in v && v.text !== undefined) return String(typeof v.text === "object" ? (v.text as { richText?: { text: string }[] }).richText?.map((t) => t.text).join("") ?? "" : v.text);
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("result" in v) return v.result === undefined || v.result === null ? "" : String(v.result);
    if ("hyperlink" in v) return String(v.hyperlink);
    return "";
  }
  return String(v).trim();
}

// Header synonyms (Naukri, LinkedIn Recruiter, common Excel trackers) → candidate field.
const SYNONYMS: Record<string, string[]> = {
  fullName: ["name", "full name", "candidate name", "candidate", "applicant name", "first name"],
  email: ["email", "email id", "e-mail", "email address", "mail id", "mail"],
  phone: ["phone", "mobile", "mobile no", "mobile number", "phone number", "contact", "contact no", "contact number", "cell"],
  altPhone: ["alternate phone", "alternate number", "alt phone", "alternate mobile", "landline"],
  location: ["location", "current location", "city", "current city", "preferred location"],
  linkedinUrl: ["linkedin", "linkedin url", "linkedin profile", "profile url"],
  currentCompany: ["company", "current company", "current employer", "employer", "organisation", "organization", "current organization"],
  currentTitle: ["designation", "current designation", "title", "job title", "current title", "role", "position", "current role"],
  industry: ["industry", "sector", "domain"],
  functionalArea: ["functional area", "function", "department"],
  totalExperience: ["experience", "total experience", "exp", "total exp", "work experience", "years of experience", "yrs of exp"],
  currentCtc: ["ctc", "current ctc", "current salary", "salary", "annual salary", "ctc lpa", "current ctc lpa"],
  expectedCtc: ["expected ctc", "expected salary", "ectc", "expected ctc lpa"],
  noticePeriodDays: ["notice period", "notice", "np", "availability", "notice period days"],
  highestDegree: ["degree", "highest degree", "qualification", "highest qualification", "ug", "pg", "education level"],
  college: ["college", "university", "institute", "institution", "ug college", "pg college"],
  education: ["education", "education details", "academics"],
  certifications: ["certifications", "certification", "certificates"],
  languages: ["languages", "language", "languages known"],
  skills: ["skills", "key skills", "skill set", "skillset", "technical skills", "primary skills", "it skills"],
  tags: ["tags", "labels", "keywords"],
  source: ["source", "lead source", "sourced from", "channel"],
  status: ["status", "candidate status"],
};

const norm = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export function autoMap(headers: string[]): Record<number, string> {
  const map: Record<number, string> = {};
  const used = new Set<string>();
  const labels = Object.fromEntries(CANDIDATE_FIELDS.map((f) => [norm(f.label), f.key]));
  headers.forEach((h, i) => {
    const n = norm(h);
    let field = labels[n];
    if (!field) field = Object.entries(SYNONYMS).find(([, syn]) => syn.includes(n))?.[0] as typeof field;
    if (!field) field = Object.entries(SYNONYMS).find(([, syn]) => syn.some((x) => x.length > 3 && n.includes(x)))?.[0] as typeof field;
    if (field && !used.has(field)) {
      map[i] = field;
      used.add(field);
    }
  });
  return map;
}
