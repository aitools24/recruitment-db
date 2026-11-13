"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";

type Dup = { id: string; fullName: string; email: string | null; phone: string | null; currentCompany: string | null };
type Initial = Record<string, string | number | string[] | null | undefined> & { id?: string };

const str = (v: unknown) => (v === null || v === undefined ? "" : Array.isArray(v) ? v.join(", ") : String(v));

export default function CandidateForm({ initial, users, industries, sources, statuses, ownerDefault }: {
  initial?: Initial; users: { id: string; name: string }[]; industries: string[]; sources: string[]; statuses: string[]; ownerDefault: string;
}) {
  const router = useRouter();
  const editing = !!initial?.id;
  const [v, setV] = useState<Record<string, string>>(() => {
    const keys = ["fullName", "email", "phone", "altPhone", "location", "linkedinUrl", "currentCompany", "currentTitle", "industry", "functionalArea",
      "totalExperience", "currentCtc", "expectedCtc", "noticePeriodDays", "highestDegree", "college", "education", "certifications", "languages",
      "skills", "tags", "source", "status", "ownerId"];
    const o = Object.fromEntries(keys.map((k) => [k, str(initial?.[k])]));
    if (!o.status) o.status = "Active";
    if (!o.ownerId) o.ownerId = ownerDefault;
    return o;
  });
  const [dups, setDups] = useState<Dup[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  async function checkDup() {
    if (!v.email && !v.phone) return setDups([]);
    const qs = new URLSearchParams({ email: v.email, phone: v.phone, ...(initial?.id ? { excludeId: initial.id } : {}) });
    const r = await api<{ duplicates: Dup[] }>(`/api/candidates/check-duplicates?${qs}`).catch(() => ({ duplicates: [] }));
    setDups(r.duplicates);
  }

  async function save(ignoreDuplicates = false) {
    setBusy(true);
    setError("");
    try {
      const payload = { ...v, noticePeriodDays: v.noticePeriodDays === "" ? null : v.noticePeriodDays, ignoreDuplicates };
      const c = await api<{ id: string }>(editing ? `/api/candidates/${initial!.id}` : "/api/candidates", { method: editing ? "PATCH" : "POST", json: payload });
      router.push(`/candidates/${c.id}`);
      router.refresh();
    } catch (e) {
      const err = e as Error & { status?: number; data?: { duplicates?: Dup[] } };
      if (err.status === 409 && err.data?.duplicates) setDups(err.data.duplicates);
      setError(err.message);
      setBusy(false);
    }
  }

  const F = ({ k, label, type = "text", ...rest }: { k: string; label: string; type?: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <div><label className="label">{label}</label><input className="input" type={type} value={v[k]} onChange={set(k)} {...rest} /></div>
  );

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(false); }} className="space-y-4">
      <Section title="Basic details">
        {F({ k: "fullName", label: "Full name *", required: true })}
        {F({ k: "email", label: "Email", type: "email", onBlur: checkDup })}
        {F({ k: "phone", label: "Phone", onBlur: checkDup, placeholder: "+91 98xxxxxxxx" })}
        {F({ k: "altPhone", label: "Alternate phone" })}
        {F({ k: "location", label: "Location", placeholder: "Mumbai" })}
        {F({ k: "linkedinUrl", label: "LinkedIn URL" })}
      </Section>
      {dups.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="font-medium">Possible duplicate{dups.length > 1 ? "s" : ""} already in the database:</div>
          <ul className="mt-1 list-disc pl-5">
            {dups.map((d) => <li key={d.id}><Link className="underline" href={`/candidates/${d.id}`} target="_blank">{d.fullName}</Link> {[d.email, d.phone, d.currentCompany].filter(Boolean).join(" · ")}</li>)}
          </ul>
        </div>
      )}
      <Section title="Current role">
        {F({ k: "currentCompany", label: "Current company" })}
        {F({ k: "currentTitle", label: "Current designation" })}
        <div><label className="label">Industry</label>
          <input className="input" list="industries" value={v.industry} onChange={set("industry")} />
          <datalist id="industries">{industries.map((i) => <option key={i} value={i} />)}</datalist>
        </div>
        {F({ k: "functionalArea", label: "Functional area", placeholder: "Sales, Engineering, Finance…" })}
        {F({ k: "totalExperience", label: "Total experience (years)", type: "number", step: "0.1", min: 0 })}
        <div><label className="label">Notice period</label>
          <select className="input" value={v.noticePeriodDays} onChange={set("noticePeriodDays")}>
            <option value="">Not known</option><option value="0">Immediate</option><option value="15">15 days</option><option value="30">30 days</option><option value="45">45 days</option><option value="60">60 days</option><option value="90">90 days</option>
            {v.noticePeriodDays && !["0", "15", "30", "45", "60", "90"].includes(v.noticePeriodDays) && <option value={v.noticePeriodDays}>{v.noticePeriodDays} days</option>}
          </select>
        </div>
        {F({ k: "currentCtc", label: "Current CTC (lakhs per annum)", type: "number", step: "0.01", min: 0 })}
        {F({ k: "expectedCtc", label: "Expected CTC (lakhs per annum)", type: "number", step: "0.01", min: 0 })}
      </Section>
      <Section title="Skills and education">
        <div className="sm:col-span-2"><label className="label">Skills (comma separated)</label><input className="input" value={v.skills} onChange={set("skills")} placeholder="java, spring boot, microservices" /></div>
        {F({ k: "highestDegree", label: "Highest degree", placeholder: "B.Tech, MBA" })}
        {F({ k: "college", label: "College / university" })}
        {F({ k: "certifications", label: "Certifications" })}
        {F({ k: "languages", label: "Languages" })}
        <div className="sm:col-span-2"><label className="label">Education details</label><textarea className="input" rows={2} value={v.education} onChange={set("education")} /></div>
      </Section>
      <Section title="Tracking">
        <div><label className="label">Source</label><select className="input" value={v.source} onChange={set("source")}><option value="">—</option>{sources.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div><label className="label">Status</label><select className="input" value={v.status} onChange={set("status")}>{statuses.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div><label className="label">Owner recruiter</label><select className="input" value={v.ownerId} onChange={set("ownerId")}>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
        {F({ k: "tags", label: "Tags (comma separated)", placeholder: "hot, client-x" })}
      </Section>
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add candidate"}</button>
        {dups.length > 0 && <button type="button" className="btn-secondary" disabled={busy} onClick={() => save(true)}>Save anyway</button>}
        <button type="button" className="btn-ghost" onClick={() => router.back()}>Cancel</button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-4">
      <h2 className="mb-3 text-sm font-semibold text-gray-800">{title}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}
