"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import Highlight from "./Highlight";
import { formatCtc, formatExp, formatNotice } from "@/lib/normalize";
import type { SearchRow } from "@/lib/candidates";

type Props = {
  users: { id: string; name: string }[];
  industries: string[];
  sources: string[];
  statuses: string[];
  canExport: boolean;
  exportMax: number;
  canEdit: boolean;
};

type Result = { rows: SearchRow[]; total: number; page: number; pageSize: number };

const MULTI = ["industry", "source", "status"];
const FIELDS = ["q", "skills", "skillsMode", "tags", "expMin", "expMax", "ctcMin", "ctcMax", "noticeMin", "noticeMax", "location", "company", "title", "degree", "ownerId", "addedFrom", "addedTo", "sort", ...MULTI];

export default function CandidateSearch(p: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const qs = sp.toString();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api<Result>(`/api/candidates?${qs}`)
      .then((d) => !cancelled && (setData(d), setError("")))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [qs]);

  useEffect(() => setQ(sp.get("q") ?? ""), [sp]);

  function update(changes: Record<string, string | string[] | null>, resetPage = true) {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(changes)) {
      next.delete(k);
      if (Array.isArray(v)) v.forEach((x) => next.append(k, x));
      else if (v) next.set(k, v);
    }
    if (resetPage) next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const activeFilters = useMemo(() => FIELDS.filter((f) => f !== "q" && f !== "sort" && f !== "skillsMode" && sp.get(f)).length, [sp]);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="text-2xl font-semibold tracking-tight text-slate-100">Candidates</h1><p className="text-sm text-slate-400">Search your whole database, including resume text.</p></div>
        <div className="flex flex-wrap gap-2">
          {p.canExport && (
            <>
              <a className="btn-secondary" href={`/api/export?${qs}&format=csv`} title={`Exports up to ${p.exportMax} rows matching the current search`}>Export CSV</a>
              <a className="btn-secondary" href={`/api/export?${qs}&format=xlsx`} title={`Exports up to ${p.exportMax} rows matching the current search`}>Export Excel</a>
            </>
          )}
          {p.canEdit && <Link href="/candidates/new" className="btn-primary">+ Add candidate</Link>}
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); update({ q: q.trim() || null }); }} className="card flex flex-wrap items-center gap-3 p-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} className="input flex-1 basis-full py-2.5 text-base sm:basis-0"
          placeholder='Search names, skills, companies and resume text… e.g. java spring -intern' />
        <button className="btn-primary px-4">Search</button>
        <button type="button" className="btn-secondary" onClick={() => setShowFilters(!showFilters)}>
          Filters{activeFilters ? ` (${activeFilters})` : ""}
        </button>
        <button type="button" className="btn-ghost text-xs" onClick={() => setShowHelp(!showHelp)}>Search tips</button>
      </form>
      {showHelp && (
        <div className="card p-3 text-sm text-slate-200">
          <ul className="list-disc space-y-1 pl-5">
            <li><code>java spring</code> finds candidates with both words anywhere in their profile or resume.</li>
            <li><code>java or python</code> finds either word.</li>
            <li><code>&quot;product manager&quot;</code> matches the exact phrase.</li>
            <li><code>sales -insurance</code> excludes profiles mentioning insurance.</li>
            <li>Paste a phone number or email to look someone up directly. Similar word forms match too (manager / managers).</li>
          </ul>
        </div>
      )}

      {showFilters && <Filters {...p} sp={sp} update={update} />}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-300">
        <span>{loading ? "Searching…" : data ? `${data.total.toLocaleString("en-IN")} candidate${data.total === 1 ? "" : "s"}` : ""}</span>
        <label className="flex items-center gap-2">Sort
          <select className="input w-auto py-1" value={sp.get("sort") ?? ""} onChange={(e) => update({ sort: e.target.value || null })}>
            <option value="">{sp.get("q") ? "Best match" : "Newest first"}</option>
            <option value="updated">Recently updated</option>
            <option value="newest">Newest first</option>
            <option value="experience">Most experience</option>
            <option value="name">Name A–Z</option>
          </select>
        </label>
      </div>

      {error && <p className="neu-in-sm rounded-xl px-3 py-2 text-sm text-red-300">{error}</p>}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="border-b border-white/[0.06] bg-white/[0.03]">
            <tr><th className="th">Candidate</th><th className="th">Experience</th><th className="th">CTC (cur / exp)</th><th className="th">Notice</th><th className="th">Location</th><th className="th">Skills</th><th className="th">Owner</th></tr>
          </thead>
          <tbody className="divide-y divide-white/[0.05]">
            {data?.rows.map((c) => (
              <tr key={c.id} className="transition hover:bg-white/[0.025]">
                <td className="td max-w-xs">
                  <Link href={`/candidates/${c.id}`} className="font-medium text-brand-300 hover:underline">{c.fullName}</Link>
                  <div className="text-xs text-slate-300">{[c.currentTitle, c.currentCompany].filter(Boolean).join(" at ")}</div>
                  {c.industry && <div className="text-xs text-slate-400">{c.industry}</div>}
                  {c.snippet && <div className="mt-1 text-xs text-slate-400"><Highlight text={c.snippet} /></div>}
                </td>
                <td className="td whitespace-nowrap">{formatExp(c.totalExperience)}</td>
                <td className="td whitespace-nowrap">{[formatCtc(c.currentCtc), formatCtc(c.expectedCtc)].filter(Boolean).join(" / ")}</td>
                <td className="td whitespace-nowrap">{formatNotice(c.noticePeriodDays)}</td>
                <td className="td">{c.location}</td>
                <td className="td max-w-[220px]">
                  <div className="flex flex-wrap gap-1">
                    {c.skills.slice(0, 5).map((s) => <span key={s} className="chip">{s}</span>)}
                    {c.skills.length > 5 && <span className="px-1 text-xs text-slate-400">+{c.skills.length - 5}</span>}
                    {c.tags.map((t) => <span key={t} className="chip-blue">#{t}</span>)}
                  </div>
                </td>
                <td className="td whitespace-nowrap text-slate-300">{c.ownerName}</td>
              </tr>
            ))}
            {data && !data.rows.length && (
              <tr><td colSpan={7} className="td py-10 text-center text-slate-400">No candidates match. Try fewer filters, or <Link className="text-brand-300 hover:underline" href="/import">import some candidates</Link>.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {data && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button className="btn-secondary" disabled={data.page <= 1} onClick={() => update({ page: String(data.page - 1) }, false)}>Previous</button>
          <span>Page {data.page} of {totalPages}</span>
          <button className="btn-secondary" disabled={data.page >= totalPages} onClick={() => update({ page: String(data.page + 1) }, false)}>Next</button>
        </div>
      )}
    </div>
  );
}

function Filters({ users, industries, sources, statuses, sp, update }: Props & { sp: URLSearchParams; update: (c: Record<string, string | string[] | null>) => void }) {
  const [f, setF] = useState<Record<string, string>>(() => Object.fromEntries(FIELDS.filter((k) => !MULTI.includes(k)).map((k) => [k, sp.get(k) ?? ""])));
  const [multi, setMulti] = useState<Record<string, string[]>>(() => Object.fromEntries(MULTI.map((k) => [k, sp.getAll(k)])));
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const toggle = (k: string, v: string) => setMulti({ ...multi, [k]: multi[k].includes(v) ? multi[k].filter((x) => x !== v) : [...multi[k], v] });

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const { q: _q, sort: _s, ...rest } = f;
    void _q; void _s;
    update({ ...Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, v.trim() || null])), ...multi });
  }
  function clear() {
    setF(Object.fromEntries(Object.keys(f).map((k) => [k, ""])));
    setMulti(Object.fromEntries(MULTI.map((k) => [k, []])));
    update(Object.fromEntries([...FIELDS.filter((k) => k !== "q" && k !== "sort")].map((k) => [k, null])));
  }

  return (
    <form onSubmit={apply} className="card space-y-4 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <label className="label">Skills (comma separated)</label>
          <div className="flex gap-2">
            <input className="input" value={f.skills} onChange={set("skills")} placeholder="java, spring boot" />
            <select className="input w-28" value={f.skillsMode || "all"} onChange={set("skillsMode")}><option value="all">All of</option><option value="any">Any of</option></select>
          </div>
        </div>
        <div><label className="label">Tags</label><input className="input" value={f.tags} onChange={set("tags")} placeholder="hot, client-x" /></div>
        <div><label className="label">Owner recruiter</label>
          <select className="input" value={f.ownerId} onChange={set("ownerId")}><option value="">Anyone</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        </div>
        <div><label className="label">Experience (years)</label>
          <div className="flex gap-2"><input type="number" min={0} step="0.5" className="input" placeholder="Min" value={f.expMin} onChange={set("expMin")} /><input type="number" min={0} step="0.5" className="input" placeholder="Max" value={f.expMax} onChange={set("expMax")} /></div>
        </div>
        <div><label className="label">Current CTC (LPA)</label>
          <div className="flex gap-2"><input type="number" min={0} step="0.5" className="input" placeholder="Min" value={f.ctcMin} onChange={set("ctcMin")} /><input type="number" min={0} step="0.5" className="input" placeholder="Max" value={f.ctcMax} onChange={set("ctcMax")} /></div>
        </div>
        <div><label className="label">Notice period</label>
          <select className="input" value={f.noticeMax} onChange={set("noticeMax")}>
            <option value="">Any</option><option value="0">Immediate</option><option value="15">15 days or less</option><option value="30">30 days or less</option><option value="60">60 days or less</option><option value="90">90 days or less</option>
          </select>
        </div>
        <div><label className="label">Location</label><input className="input" value={f.location} onChange={set("location")} placeholder="Mumbai" /></div>
        <div><label className="label">Current company</label><input className="input" value={f.company} onChange={set("company")} /></div>
        <div><label className="label">Designation</label><input className="input" value={f.title} onChange={set("title")} /></div>
        <div><label className="label">Degree / education</label><input className="input" value={f.degree} onChange={set("degree")} placeholder="MBA" /></div>
        <div><label className="label">Added between</label>
          <div className="flex gap-2"><input type="date" className="input" value={f.addedFrom} onChange={set("addedFrom")} /><input type="date" className="input" value={f.addedTo} onChange={set("addedTo")} /></div>
        </div>
      </div>
      <Checks label="Industry" options={industries} value={multi.industry} onToggle={(v) => toggle("industry", v)} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Checks label="Source" options={sources} value={multi.source} onToggle={(v) => toggle("source", v)} />
        <Checks label="Status" options={statuses} value={multi.status} onToggle={(v) => toggle("status", v)} />
      </div>
      <div className="flex gap-2">
        <button className="btn-primary">Apply filters</button>
        <button type="button" className="btn-ghost" onClick={clear}>Clear all</button>
      </div>
    </form>
  );
}

function Checks({ label, options, value, onToggle }: { label: string; options: string[]; value: string[]; onToggle: (v: string) => void }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button type="button" key={o} onClick={() => onToggle(o)}
            className={`rounded-full px-3 py-1 text-xs transition ${value.includes(o) ? "neu-in-sm font-medium text-brand-300 ring-1 ring-brand-400/50" : "neu-sm text-slate-300 hover:text-white"}`}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}
