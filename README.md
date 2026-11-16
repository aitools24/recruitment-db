# TalentBase — recruitment candidate database (v1)

A multi-tenant SaaS candidate database (ATS-lite) for recruitment teams. Each company that signs up gets its own isolated workspace.

## What's in v1

- **Candidate profiles**: contact details, location, current company and designation, industry, functional area, experience, current/expected CTC (LPA), notice period, education, certifications, languages, skills, tags, source, status and owner recruiter.
- **Notes and activity**: notes on every profile, plus a timeline of who created, edited, merged, uploaded or downloaded what.
- **Spreadsheet import**: CSV or Excel (.xlsx) upload, automatic column matching (understands Naukri/LinkedIn-style headers such as "Mobile No.", "Key Skills", "Current CTC"), a preview before anything is saved, a choice of what to do with duplicates (skip, update or create), and a downloadable error report.
- **Bulk resume upload**: PDF, DOCX, TXT or a ZIP of many. Each resume is parsed for name, email, phone, LinkedIn, location, total experience, notice period and skills. If the email or phone already exists, the resume is added to that profile as a new version.
- **Search**: one search bar over names, skills, companies, designations and the full text of resumes, with highlighted matches. Supports `java spring` (both), `java or python` (either), `"product manager"` (phrase), `sales -insurance` (exclude), phone/email lookup and typo-tolerant name matching.
- **Filters**: skills (all of / any of), tags, owner, experience range, CTC range, notice period, location, company, designation, degree, date added, industry, source and status. Filters live in the URL, so a filtered list can be bookmarked or shared with the team.
- **Duplicates**: warnings when adding a candidate with an existing email/phone, and a Duplicates page to merge copies (blank fields filled, skills/tags combined, resumes, notes and history moved).
- **Roles**: Admin, Manager, Recruiter and View-only (see Team & settings in the app for exactly what each can do).
- **Placement pipeline**: every candidate can move through Submitted to internal team → Submitted to client → Interview scheduled → Offer → Onboarding → Billing, with client, position, interview time, offered CTC, joining date and billing details. Each move is kept in a stage history. A Pipeline page shows a board per stage plus alerts for who is ready to bill, billing due soon, guarantees ending soon and upcoming interviews.
- **Clients**: a Clients tab with each client's company details, GSTIN, main contact, placement fee, agreement dates and notes, plus how many of their candidates sit at each stage. A client can have its own billing and guarantee days, which override the workspace defaults for its placements. Pipeline candidates are linked to a client (pick one, or add a new one right from the stage form).
- **Pipeline charts**: the Pipeline page shows candidates by stage, the stage mix per client, and the average days candidates have spent in their current stage.
- **Billing and guarantee timers**: from the joining date, the profile shows a live countdown to the billing date (default 30 days) and to the end of the guarantee period (default 90 days). Admins change both under Team & settings → Placement terms. Run `npm run db:demo-pipeline` to add 3 sample clients and sample pipeline data to the demo workspace.
- **Export controls**: CSV/Excel export of the current search, limited to the roles and row cap an Admin chooses. Every export, view, download and change is written to the activity log.

Not yet built: job openings as their own records, email/WhatsApp messaging, invoicing and payments, AI semantic search and AI parsing, 2FA/SSO.

## Tech stack

Next.js 15 (App Router) + TypeScript, PostgreSQL 16 with Prisma, Postgres full-text search (`tsvector` + GIN index) and `pg_trgm` for fuzzy names, Tailwind CSS. Resume parsing is free and offline (`unpdf`, `mammoth` + rules); no paid APIs are used.

## Run it locally

Requirements: Node.js 20+ and PostgreSQL 16 (Docker is the easiest way to get it).

```bash
# 1. Install dependencies
npm install

# 2. Start PostgreSQL (or point DATABASE_URL at your own server)
docker compose up -d

# 3. Configure environment
cp .env.example .env        # then set AUTH_SECRET to a long random string

# 4. Create the database tables
npm run db:migrate

# 5. (Optional) Load demo data
npm run db:seed             # admin@demo.test / password123 (also manager@, recruiter@, viewer@demo.test)

# 6. Start the app
npm run dev                 # http://localhost:3000
```

Open http://localhost:3000 and either sign in with a demo account or click **Create a workspace** to start a fresh company account (you become its Admin and can add your team under **Team & settings**).

For production: `npm run build && npm start`, with `DATABASE_URL`, a strong `AUTH_SECRET` and a persistent `STORAGE_DIR` (or swap `src/lib/storage.ts` for S3/GCS).

## Project layout

```
prisma/schema.prisma          data model (every table carries tenantId)
prisma/migrations/            SQL migrations, incl. the full-text search column
prisma/seed.ts                demo data
src/lib/candidates.ts         search, filters, duplicate detection, merge
src/lib/ingest.ts             spreadsheet row import and resume ingestion
src/lib/resume-parser.ts      text extraction and rule-based resume parsing
src/lib/normalize.ts          CTC / experience / notice period / phone parsing
src/lib/permissions.ts        role → permission matrix
src/lib/auth.ts, session.ts   login sessions (signed httpOnly cookie)
src/app/api/                  REST endpoints
src/app/(app)/                app screens
```

## Notes on multi-tenancy and security

- Every query is scoped by the signed-in user's `tenantId`; IDs from another workspace return "not found".
- Passwords are hashed with bcrypt; sessions are signed JWTs in an httpOnly cookie and are re-checked against the database on each request, so deactivating a user or changing their role takes effect immediately.
- Exports neutralise spreadsheet formula injection, and resume downloads are served with `no-store` and `nosniff`.
- Old `.doc` and `.xls` files aren't supported yet; save them as `.docx` / `.xlsx`.
