// Demo data: `npm run db:seed`. Creates the "Demo Recruiters" workspace with 4 users (one per role) and 60 candidates.
import { PrismaClient, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const first = ["Aarav", "Vivaan", "Aditya", "Ananya", "Diya", "Ishaan", "Kavya", "Rohan", "Sneha", "Arjun", "Meera", "Karan", "Pooja", "Siddharth", "Nisha", "Rahul", "Priya", "Vikram", "Anjali", "Manish"];
const last = ["Sharma", "Verma", "Iyer", "Nair", "Reddy", "Patel", "Gupta", "Mehta", "Kulkarni", "Das", "Singh", "Joshi", "Menon", "Rao", "Chopra"];
const cities = ["Mumbai", "Pune", "Bengaluru", "Hyderabad", "Chennai", "Delhi", "Gurugram", "Noida", "Ahmedabad", "Kolkata"];
const profiles = [
  { industry: "IT / Software", title: "Java Developer", companies: ["Infosys", "TCS", "Wipro", "HCL"], skills: ["java", "spring boot", "microservices", "sql", "aws"] },
  { industry: "IT / Software", title: "Frontend Engineer", companies: ["Flipkart", "Swiggy", "Razorpay"], skills: ["react", "typescript", "javascript", "css", "next.js"] },
  { industry: "IT / Software", title: "Data Analyst", companies: ["Mu Sigma", "Fractal", "Accenture"], skills: ["sql", "python", "power bi", "tableau", "excel"] },
  { industry: "BFSI", title: "Relationship Manager", companies: ["HDFC Bank", "ICICI Bank", "Axis Bank"], skills: ["sales", "crm", "wealth management", "communication"] },
  { industry: "Pharma / Healthcare", title: "Area Sales Manager", companies: ["Sun Pharma", "Cipla", "Lupin"], skills: ["b2b sales", "channel sales", "key account management", "negotiation"] },
  { industry: "Manufacturing", title: "Production Engineer", companies: ["Tata Steel", "Mahindra", "L&T"], skills: ["autocad", "production", "quality control", "plc"] },
  { industry: "FMCG / Retail", title: "Brand Manager", companies: ["HUL", "ITC", "Dabur"], skills: ["brand management", "marketing", "digital marketing"] },
];
const sources = ["LinkedIn", "Naukri", "Referral", "Job portal", "Walk-in"];
const pick = <T,>(a: T[], i: number) => a[i % a.length];

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: "admin@demo.test" } });
  if (existing) await prisma.tenant.delete({ where: { id: existing.tenantId } });
  const hash = await bcrypt.hash("password123", 10);
  const tenant = await prisma.tenant.create({ data: { name: "Demo Recruiters" } });
  const users = await Promise.all(
    ([["admin", "ADMIN", "Asha Admin"], ["manager", "MANAGER", "Manoj Manager"], ["recruiter", "RECRUITER", "Riya Recruiter"], ["viewer", "VIEWER", "Vinod Viewer"]] as [string, Role, string][]).map(
      ([e, role, name]) => prisma.user.create({ data: { tenantId: tenant.id, email: `${e}@demo.test`, name, role, passwordHash: hash } }),
    ),
  );
  for (let i = 0; i < 60; i++) {
    const p = pick(profiles, i);
    const exp = Math.round((1 + ((i * 7) % 15) + (i % 3) * 0.5) * 10) / 10;
    const ctc = Math.round((3 + exp * 1.8 + (i % 5)) * 10) / 10;
    const name = `${pick(first, i)} ${pick(last, i * 3 + 1)}`;
    await prisma.candidate.create({
      data: {
        tenantId: tenant.id,
        fullName: name,
        email: `${name.toLowerCase().replace(" ", ".")}${i}@example.com`,
        emailLower: `${name.toLowerCase().replace(" ", ".")}${i}@example.com`,
        phone: `98${String(10000000 + i * 7919).slice(0, 8)}`,
        phoneNormalized: `98${String(10000000 + i * 7919).slice(0, 8)}`,
        location: pick(cities, i * 5),
        currentCompany: pick(p.companies, i),
        currentTitle: exp > 8 ? `Senior ${p.title}` : p.title,
        industry: p.industry,
        totalExperience: exp,
        currentCtc: ctc,
        expectedCtc: Math.round(ctc * 1.3 * 10) / 10,
        noticePeriodDays: pick([0, 15, 30, 60, 90], i),
        highestDegree: pick(["B.Tech", "MBA", "B.Com", "M.Tech", "B.Sc"], i),
        skills: p.skills.slice(0, 3 + (i % 3)),
        tags: i % 6 === 0 ? ["hot"] : [],
        source: pick(sources, i),
        status: i % 11 === 0 ? "Placed" : "Active",
        ownerId: pick(users, i % 3).id,
        createdAt: new Date(Date.now() - i * 86400000 * 2),
      },
    });
  }
  console.log("Seeded workspace 'Demo Recruiters'. Sign in as admin@demo.test / password123 (also manager@, recruiter@, viewer@).");
}

main().finally(() => prisma.$disconnect());
