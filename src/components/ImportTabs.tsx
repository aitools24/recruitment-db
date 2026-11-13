"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "./api";

type Field = { key: string; label: string };

export default function ImportTabs({ fields, sources }: { fields: Field[]; sources: string[] }) {
  const [tab, setTab] = useState<"sheet" | "resumes">("sheet");
  return (
    <div>
      <div className="mb-3 flex gap-1 border-b border-gray-200">
        {([["sheet", "Spreadsheet (CSV / Excel)"], ["resumes", "Resumes (PDF / DOCX / ZIP)"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === k ? "border-brand-600 font-medium text-brand-700" : "border-transparent text-gray-600 hover:text-gray-900"}`}>{l}</button>
        ))}
      </div>
      {tab === "sheet" ? <SpreadsheetImport fields={fields} sources={sources} /> : <ResumeImport sources={sources} />}
    </div>
  );
}

// ---------------- Spreadsheet ----------------

type Parsed = { fileName: string; headers: string[]; rows: string[][]; mapping: Record<number, string> };
type RowResult = { row: number; status: "created" | "updated" | "skipped" | "failed"; candidateId?: string; error?: string };

function SpreadsheetImport({ fields, sources }: { fields: Field[]; sources: string[] }) {
  const router = useRouter();
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [dupMode, setDupMode] = useState<"skip" | "update" | "create">("skip");
  const [source, setSource] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<RowResult[] | null>(null);

  async function choose(file: File) {
    setError(""); setResults(null); setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const p = await api<Parsed>("/api/import/parse", { method: "POST", body: fd });
      setParsed(p);
      setMapping(p.mapping);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  const mappedFields = Object.values(mapping).filter(Boolean);
  const canImport = ["fullName", "email", "phone"].some((f) => mappedFields.includes(f));
  const toRecord = (r: string[]) => Object.fromEntries(Object.entries(mapping).filter(([, f]) => f).map(([i, f]) => [f, r[Number(i)]]));

  async function runImport() {
    if (!parsed) return;
    setBusy(true); setError(""); setProgress(0);
    const all: RowResult[] = [];
    let jobId: string | undefined;
    const rows = parsed.rows.map((r, i) => ({ row: i + 2, data: toRecord(r) }));
    try {
      for (let i = 0; i < rows.length; i += 500) {
        const res = await api<{ jobId: string; results: RowResult[] }>("/api/import/commit", {
          method: "POST",
          json: { jobId, fileName: parsed.fileName, duplicateMode: dupMode, source: source || undefined, tags: tags.split(",").map((t) => t.trim()).filter(Boolean), rows: rows.slice(i, i + 500), totalRows: rows.length },
        });
        jobId = res.jobId;
        all.push(...res.results);
        setProgress(Math.min(rows.length, i + 500));
      }
    } catch (e) {
      setError(`Import stopped: ${(e as Error).message}. ${all.length} rows were processed before this.`);
    }
    setResults(all);
    setBusy(false);
    router.refresh();
  }

  function downloadReport() {
    if (!parsed || !results) return;
    const bad = results.filter((r) => r.status === "failed" || r.status === "skipped");
    const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["Row", "Status", "Reason", ...parsed.headers].map(esc).join(",")];
    for (const r of bad) lines.push([String(r.row), r.status, r.error ?? "", ...parsed.rows[r.row - 2]].map(esc).join(","));
    const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `import-errors-${parsed.fileName.replace(/\.[^.]+$/, "")}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (results) {
    const n = (s: string) => results.filter((r) => r.status === s).length;
    return (
      <div className="card space-y-3 p-4">
        <h2 className="font-semibold">Import finished</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <Stat label="New candidates" value={n("created")} tone="green" />
          <Stat label="Updated existing" value={n("updated")} />
          <Stat label="Skipped duplicates" value={n("skipped")} />
          <Stat label="Failed" value={n("failed")} tone={n("failed") ? "red" : undefined} />
        </div>
        {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap gap-2">
          {(n("failed") > 0 || n("skipped") > 0) && <button className="btn-secondary" onClick={downloadReport}>Download error report</button>}
          <Link className="btn-primary" href="/candidates?sort=newest">View candidates</Link>
          <button className="btn-ghost" onClick={() => { setParsed(null); setResults(null); }}>Import another file</button>
        </div>
      </div>
    );
  }

  if (!parsed) {
    return (
      <div className="space-y-3">
        <DropZone accept=".csv,.xlsx" busy={busy} label="Drop a CSV or Excel (.xlsx) file here, or click to choose" onFiles={(f) => choose(f[0])} />
        <p className="text-xs text-gray-500">Works with Naukri / LinkedIn exports and your own trackers. You&apos;ll match columns and preview before anything is saved. Up to 20,000 rows per file.</p>
        {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
    );
  }

  const preview = parsed.rows.slice(0, 8);
  const shownFields = fields.filter((f) => mappedFields.includes(f.key));
  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">1. Match columns <span className="font-normal text-gray-500">({parsed.fileName}, {parsed.rows.length.toLocaleString("en-IN")} rows)</span></h2>
          <button className="btn-ghost text-xs" onClick={() => setParsed(null)}>Choose a different file</button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {parsed.headers.map((h, i) => (
            <div key={i} className="rounded border border-gray-200 p-2">
              <div className="truncate text-sm font-medium" title={h}>{h}</div>
              <div className="mb-1 truncate text-xs text-gray-400" title={parsed.rows[0]?.[i]}>e.g. {parsed.rows.find((r) => r[i])?.[i] || "—"}</div>
              <select className="input py-1" value={mapping[i] ?? ""} onChange={(e) => setMapping({ ...mapping, [i]: e.target.value })}>
                <option value="">Don&apos;t import</option>
                {fields.map((f) => <option key={f.key} value={f.key} disabled={mappedFields.includes(f.key) && mapping[i] !== f.key}>{f.label}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 font-semibold">2. Options</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="label">If a candidate already exists (same email or phone)</label>
            <select className="input" value={dupMode} onChange={(e) => setDupMode(e.target.value as typeof dupMode)}>
              <option value="skip">Skip the row</option><option value="update">Update the existing profile</option><option value="create">Create a new profile anyway</option>
            </select>
          </div>
          <div><label className="label">Source for rows without one</label>
            <select className="input" value={source} onChange={(e) => setSource(e.target.value)}><option value="">—</option>{sources.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
          <div><label className="label">Add tags to every row</label><input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. naukri-nov-2026" /></div>
        </div>
      </div>

      <div className="card p-4">
        <h2 className="mb-3 font-semibold">3. Preview <span className="font-normal text-gray-500">(first {preview.length} rows; values like &quot;12,00,000&quot; or &quot;2 months&quot; are converted on import)</span></h2>
        {shownFields.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50"><tr>{shownFields.map((f) => <th key={f.key} className="th whitespace-nowrap">{f.label}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">
                {preview.map((r, i) => { const rec = toRecord(r); return <tr key={i}>{shownFields.map((f) => <td key={f.key} className="px-3 py-1.5 whitespace-nowrap">{rec[f.key]}</td>)}</tr>; })}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-gray-500">Map at least one column to see a preview.</p>}
        {!canImport && <p className="mt-2 text-sm text-amber-700">Map a Name, Email or Phone column to continue.</p>}
        {error && <p className="mt-2 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="mt-3 flex items-center gap-3">
          <button className="btn-primary" disabled={!canImport || busy} onClick={runImport}>{busy ? `Importing… ${progress}/${parsed.rows.length}` : `Import ${parsed.rows.length.toLocaleString("en-IN")} rows`}</button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Resumes ----------------

type ResumeResult = { fileName: string; status: "created" | "attached" | "failed"; candidateId?: string; candidateName?: string; error?: string };

function ResumeImport({ sources }: { sources: string[] }) {
  const router = useRouter();
  const [results, setResults] = useState<ResumeResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [source, setSource] = useState("Resume upload");

  async function upload(files: File[]) {
    setBusy(true);
    setResults([]);
    setProgress({ done: 0, total: files.length });
    // ZIPs go alone; other files in batches of 5 to keep requests small.
    const batches: File[][] = [];
    let cur: File[] = [];
    for (const f of files) {
      if (f.name.toLowerCase().endsWith(".zip")) batches.push([f]);
      else { cur.push(f); if (cur.length === 5) { batches.push(cur); cur = []; } }
    }
    if (cur.length) batches.push(cur);
    let done = 0;
    for (const b of batches) {
      const fd = new FormData();
      b.forEach((f) => fd.append("files", f));
      fd.append("source", source);
      try {
        const r = await api<{ results: ResumeResult[] }>("/api/import/resumes", { method: "POST", body: fd });
        setResults((prev) => [...prev, ...r.results]);
      } catch (e) {
        setResults((prev) => [...prev, ...b.map((f) => ({ fileName: f.name, status: "failed" as const, error: (e as Error).message }))]);
      }
      done += b.length;
      setProgress({ done, total: files.length });
    }
    setBusy(false);
    router.refresh();
  }

  const n = (s: string) => results.filter((r) => r.status === s).length;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div><label className="label">Source</label><select className="input w-48" value={source} onChange={(e) => setSource(e.target.value)}>{sources.map((s) => <option key={s}>{s}</option>)}</select></div>
      </div>
      <DropZone multiple accept=".pdf,.docx,.txt,.zip" busy={busy} label="Drop resumes here (PDF, DOCX, TXT, or a ZIP of many), or click to choose" onFiles={upload} />
      <p className="text-xs text-gray-500">Each resume is read automatically: name, email, phone, LinkedIn, location, experience, notice period and skills are filled in. If the email or phone already exists, the resume is added to that profile as a new version instead of creating a duplicate.</p>
      {busy && <p className="text-sm text-gray-600">Processing {progress.done} of {progress.total} upload(s)…</p>}
      {results.length > 0 && (
        <div className="card overflow-x-auto">
          <div className="flex flex-wrap gap-3 border-b border-gray-100 p-3 text-sm">
            <Stat label="New candidates" value={n("created")} tone="green" /><Stat label="Added to existing" value={n("attached")} /><Stat label="Failed" value={n("failed")} tone={n("failed") ? "red" : undefined} />
          </div>
          <table className="w-full min-w-[560px]">
            <thead className="bg-gray-50"><tr><th className="th">File</th><th className="th">Result</th><th className="th">Candidate</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {results.map((r, i) => (
                <tr key={i}>
                  <td className="td">{r.fileName}</td>
                  <td className={`td ${r.status === "failed" ? "text-red-700" : ""}`}>{r.status === "created" ? "New profile" : r.status === "attached" ? "Added to existing profile" : `Failed: ${r.error}`}</td>
                  <td className="td">{r.candidateId && <Link className="text-brand-700 hover:underline" href={`/candidates/${r.candidateId}`}>{r.candidateName}</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DropZone({ accept, multiple, busy, label, onFiles }: { accept: string; multiple?: boolean; busy: boolean; label: string; onFiles: (f: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      onClick={() => !busy && input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!busy && e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]); }}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-10 text-center text-sm ${over ? "border-brand-500 bg-brand-50" : "border-gray-300 bg-white hover:bg-gray-50"} ${busy ? "cursor-wait opacity-60" : ""}`}
    >
      <div className="text-gray-700">{busy ? "Working…" : label}</div>
      <input ref={input} type="file" hidden accept={accept} multiple={multiple} onChange={(e) => { if (e.target.files?.length) onFiles([...e.target.files]); e.target.value = ""; }} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "green" | "red" }) {
  return (
    <div className={`rounded-md px-3 py-1.5 ${tone === "green" ? "bg-green-50 text-green-800" : tone === "red" ? "bg-red-50 text-red-800" : "bg-gray-100 text-gray-800"}`}>
      <span className="font-semibold">{value}</span> {label}
    </div>
  );
}
