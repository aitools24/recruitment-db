// Free, offline resume parsing: text extraction + rule-based field detection.
// No paid AI API is called. An LLM-based parser can be plugged in later behind parseResumeText().
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { normalizeEmail, normalizePhone, parseExperience, parseNotice, uniqLower } from "./normalize";

export const RESUME_EXTENSIONS = [".pdf", ".docx", ".txt"];

export async function extractResumeText(fileName: string, data: Buffer): Promise<string> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) {
    const pdf = await getDocumentProxy(new Uint8Array(data));
    const { text } = await extractText(pdf, { mergePages: true });
    return tidy(text);
  }
  if (lower.endsWith(".docx")) {
    const { value } = await mammoth.extractRawText({ buffer: data });
    return tidy(value);
  }
  if (lower.endsWith(".txt")) return tidy(data.toString("utf8"));
  throw new Error("Unsupported file type (use PDF, DOCX or TXT)");
}

const tidy = (t: string) => t.replace(/\u0000/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

// A compact skills dictionary covering IT and common non-IT recruitment areas. Extend freely.
const SKILLS = [
  "java", "spring", "spring boot", "hibernate", "microservices", "python", "django", "flask", "fastapi",
  "javascript", "typescript", "react", "angular", "vue", "node.js", "next.js", "express", "html", "css",
  "php", "laravel", "ruby", "rails", "go", "golang", "rust", "c++", "c#", ".net", "asp.net", "kotlin", "swift",
  "android", "ios", "flutter", "react native", "sql", "mysql", "postgresql", "oracle", "mongodb", "redis",
  "elasticsearch", "kafka", "spark", "hadoop", "aws", "azure", "gcp", "docker", "kubernetes", "terraform",
  "jenkins", "devops", "ci/cd", "linux", "git", "machine learning", "deep learning", "data science", "nlp",
  "tensorflow", "pytorch", "power bi", "tableau", "excel", "sap", "sap fico", "sap mm", "sap sd", "salesforce",
  "selenium", "manual testing", "automation testing", "jira", "agile", "scrum", "project management",
  "product management", "business analysis", "ui/ux", "figma", "photoshop", "seo", "digital marketing",
  "social media", "content writing", "sales", "b2b sales", "inside sales", "business development",
  "key account management", "channel sales", "retail", "marketing", "brand management", "accounting",
  "tally", "gst", "taxation", "audit", "financial analysis", "investment banking", "credit", "risk management",
  "recruitment", "talent acquisition", "hr operations", "payroll", "customer service", "operations",
  "supply chain", "logistics", "procurement", "quality control", "production", "autocad", "solidworks",
  "plc", "pharmacovigilance", "clinical research", "regulatory affairs", "medical representative",
  "negotiation", "communication", "leadership", "team management",
];

const CITIES = [
  "Mumbai", "Navi Mumbai", "Thane", "Pune", "Delhi", "New Delhi", "Noida", "Gurgaon", "Gurugram", "Bangalore",
  "Bengaluru", "Hyderabad", "Chennai", "Kolkata", "Ahmedabad", "Jaipur", "Chandigarh", "Lucknow", "Indore",
  "Kochi", "Coimbatore", "Nagpur", "Vadodara", "Surat", "Bhopal", "Visakhapatnam", "Bhubaneswar", "Mysore",
  "Trivandrum", "Goa", "Dubai", "Singapore", "London",
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type ParsedResume = {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  location: string | null;
  totalExperience: number | null;
  noticePeriodDays: number | null;
  skills: string[];
};

export function parseResumeText(text: string, fileName = ""): ParsedResume {
  const email = normalizeEmail(text);
  const phoneMatch = text.match(/(?:\+?91[\s-]?)?(?:0)?[6-9]\d{2}[\s-]?\d{3}[\s-]?\d{4}\b|\+?\d[\d\s-]{9,15}\d/);
  const phone = phoneMatch ? phoneMatch[0].replace(/\s+/g, " ").trim() : null;
  const linkedin = text.match(/(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9_\-%]+/i)?.[0] ?? null;

  const lowerText = ` ${text.toLowerCase()} `;
  const skills = uniqLower(
    SKILLS.filter((s) => new RegExp(`(^|[^a-z0-9+#.])${escape(s)}($|[^a-z0-9+#])`, "i").test(lowerText)),
  );

  const location = CITIES.find((c) => new RegExp(`\\b${escape(c)}\\b`, "i").test(text.slice(0, 1500))) ?? null;

  const expMatch =
    text.match(/(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)(?:\s*(?:and\s*)?(\d{1,2})\s*months?)?\s*(?:of\s+)?(?:total\s+|overall\s+|professional\s+|work\s+|industry\s+|relevant\s+)*experience/i) ??
    text.match(/experience\s*[:\-–]?\s*(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)/i);
  const totalExperience = expMatch ? parseExperience(`${expMatch[1]} years ${expMatch[2] ? expMatch[2] + " months" : ""}`) : null;

  const noticeMatch = text.match(/notice\s*period\s*[:\-–]?\s*([^\n]{1,30})/i);
  const noticePeriodDays = noticeMatch ? parseNotice(noticeMatch[1]) : null;

  return {
    fullName: guessName(text, email, fileName),
    email,
    phone: normalizePhone(phone) ? phone : null,
    linkedinUrl: linkedin,
    location,
    totalExperience,
    noticePeriodDays,
    skills,
  };
}

const NOT_NAME = /resume|curriculum|vitae|\bcv\b|profile|summary|objective|contact|email|phone|mobile|address|@|\d{3}|http|linkedin|page \d/i;

function guessName(text: string, email: string | null, fileName: string): string | null {
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean).slice(0, 15);
  for (const raw of lines) {
    const line = raw.replace(/^(name\s*[:\-–]\s*)/i, "").replace(/[|•·,].*$/, "").trim();
    if (NOT_NAME.test(line)) continue;
    const words = line.split(/\s+/);
    if (words.length >= 1 && words.length <= 4 && words.every((w) => /^[A-Za-z][A-Za-z.'\-]*$/.test(w)) && line.length <= 40) {
      return titleCase(line);
    }
  }
  // Fall back to file name ("Rahul_Sharma_Resume.pdf") or email local part.
  const fromFile = fileName.replace(/\.[^.]+$/, "").replace(/[_\-.]+/g, " ").replace(/\b(resume|cv|updated|final|new|\d+)\b/gi, "").trim();
  if (fromFile && /^[A-Za-z ]{3,40}$/.test(fromFile) && fromFile.split(/\s+/).length <= 4) return titleCase(fromFile);
  if (email) return titleCase(email.split("@")[0].replace(/[\d._-]+/g, " ").trim()) || null;
  return null;
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\s+/g, " ").trim();
