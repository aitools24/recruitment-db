// Parsing helpers for messy recruitment data (Naukri/LinkedIn exports, Excel sheets, resumes).

export const SOURCES = ["LinkedIn", "Naukri", "Referral", "Job portal", "Walk-in", "Resume upload", "Other"];
export const STATUSES = ["Active", "Placed", "Not looking", "Do not contact"];
export const INDUSTRIES = [
  "IT / Software", "BFSI", "Pharma / Healthcare", "Manufacturing", "FMCG / Retail", "Automobile",
  "Telecom", "E-commerce", "Education", "Real Estate / Construction", "Consulting", "Media / Advertising",
  "Logistics", "Energy / Oil & Gas", "Hospitality", "Other",
];

export function clean(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s === "" || s === "-" || s.toLowerCase() === "na" || s.toLowerCase() === "n/a" ? null : s;
}

export function normalizeEmail(v: unknown): string | null {
  const s = clean(v);
  if (!s) return null;
  const m = s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0].toLowerCase() : null;
}

/** Last 10 digits — matches +91 98xxx, 098xxx and 98xxx as the same number. */
export function normalizePhone(v: unknown): string | null {
  const s = clean(v);
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits.length >= 6 ? digits : null;
}

export function toList(v: unknown): string[] {
  if (Array.isArray(v)) return uniqLower(v.map(String));
  const s = clean(v);
  if (!s) return [];
  return uniqLower(s.split(/[,;|\n]+/));
}

export function uniqLower(arr: string[]) {
  const out = new Set<string>();
  for (const a of arr) {
    const t = a.trim().toLowerCase();
    if (t && t.length <= 60) out.add(t);
  }
  return [...out];
}

/** "5", "5.5", "5 years 6 months", "5 Yrs", "5+ years", "66 months" → years */
export function parseExperience(v: unknown): number | null {
  const s = clean(v)?.toLowerCase();
  if (!s) return null;
  if (/fresher/.test(s)) return 0;
  const y = s.match(/(\d+(?:\.\d+)?)\s*\+?\s*(?:years?|yrs?|y\b)/);
  const m = s.match(/(\d+)\s*(?:months?|mos?|m\b)/);
  if (y || m) {
    const val = (y ? parseFloat(y[1]) : 0) + (m ? parseInt(m[1]) / 12 : 0);
    return Math.round(val * 10) / 10;
  }
  const n = parseFloat(s.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n < 60 ? n : null;
}

/** CTC in lakhs per annum: "12 LPA", "12L", "12,00,000", "1.2 Cr", "1200000", "12" → 12 */
export function parseCtc(v: unknown): number | null {
  const s = clean(v)?.toLowerCase().replace(/inr|rs\.?|₹/g, "");
  if (!s) return null;
  const num = parseFloat(s.replace(/,/g, "").match(/\d+(?:\.\d+)?/)?.[0] ?? "");
  if (!Number.isFinite(num)) return null;
  if (/cr/.test(s)) return round(num * 100);
  if (/lpa|lac|lakh|\bl\b|\dl/.test(s)) return round(num);
  if (/k\b|\dk/.test(s)) return round((num * 1000) / 100000);
  if (num >= 10000) return round(num / 100000); // absolute rupees
  return round(num); // assume already in lakhs
}

/** "Immediate", "15 days", "1 month", "2 Months", "90" → days */
export function parseNotice(v: unknown): number | null {
  const s = clean(v)?.toLowerCase();
  if (!s) return null;
  if (/immediate|serving|^0\s*(days?)?$/.test(s)) return 0;
  const n = parseFloat(s.match(/\d+(?:\.\d+)?/)?.[0] ?? "");
  if (!Number.isFinite(n)) return null;
  if (/month/.test(s)) return Math.round(n * 30);
  if (/week/.test(s)) return Math.round(n * 7);
  return Math.round(n);
}

const round = (n: number) => Math.round(n * 100) / 100;

export function formatCtc(n: number | null | undefined) {
  return n === null || n === undefined ? "" : `${n} LPA`;
}
export function formatNotice(n: number | null | undefined) {
  if (n === null || n === undefined) return "";
  return n === 0 ? "Immediate" : `${n} days`;
}
export function formatExp(n: number | null | undefined) {
  return n === null || n === undefined ? "" : `${n} yrs`;
}
