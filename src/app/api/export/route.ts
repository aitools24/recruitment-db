import ExcelJS from "exceljs";
import Papa from "papaparse";
import { prisma } from "@/lib/db";
import { HttpError, handler, requireApi } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { exportCandidates, parseSearchParams } from "@/lib/candidates";

const COLUMNS: [string, string][] = [
  ["fullName", "Name"], ["email", "Email"], ["phone", "Phone"], ["altPhone", "Alternate phone"], ["location", "Location"],
  ["currentCompany", "Current company"], ["currentTitle", "Designation"], ["industry", "Industry"], ["functionalArea", "Functional area"],
  ["totalExperience", "Experience (yrs)"], ["currentCtc", "Current CTC (LPA)"], ["expectedCtc", "Expected CTC (LPA)"],
  ["noticePeriodDays", "Notice (days)"], ["highestDegree", "Degree"], ["college", "College"], ["certifications", "Certifications"],
  ["languages", "Languages"], ["skills", "Skills"], ["tags", "Tags"], ["source", "Source"], ["status", "Status"],
  ["ownerName", "Owner"], ["linkedinUrl", "LinkedIn"], ["createdAt", "Added on"], ["updatedAt", "Updated on"],
];

// Export the current search/filter result. Allowed roles and the row cap come from Settings > Export.
export const GET = handler(async (req: Request) => {
  const s = await requireApi("viewCandidates");
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: s.tenantId } });
  if (!tenant.exportRoles.includes(s.role)) throw new HttpError(403, "Your role isn't allowed to export. Ask an Admin.");
  const sp = new URL(req.url).searchParams;
  const format = sp.get("format") === "xlsx" ? "xlsx" : "csv";
  const params = parseSearchParams(sp);
  const rows = await exportCandidates(s.tenantId, params, tenant.exportMaxRows);
  const table = rows.map((r) => COLUMNS.map(([k]) => {
    const v = r[k];
    return v instanceof Date ? v.toISOString().slice(0, 10) : v ?? "";
  }));
  const filters = Object.fromEntries([...sp.entries()].filter(([k]) => k !== "format"));
  await audit(s, "EXPORT", `Exported ${rows.length} candidate(s) as ${format.toUpperCase()}`, { meta: { filters, count: rows.length } });
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const csv = "﻿" + Papa.unparse({ fields: COLUMNS.map(([, l]) => l), data: table.map((r) => r.map(safeCell)) });
    return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="candidates-${stamp}.csv"` } });
  }
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Candidates");
  ws.addRow(COLUMNS.map(([, l]) => l)).font = { bold: true };
  table.forEach((r) => ws.addRow(r));
  ws.columns.forEach((c) => (c.width = 18));
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="candidates-${stamp}.xlsx"`,
    },
  });
});

// Neutralise spreadsheet formula injection (=, +, -, @ at the start of a cell).
function safeCell(v: unknown) {
  const s = String(v ?? "");
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}
