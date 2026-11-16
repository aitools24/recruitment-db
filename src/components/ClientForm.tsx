"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";
import { CLIENT_STATUSES } from "@/lib/clients";
import { INDUSTRIES } from "@/lib/normalize";

export type ClientValues = Record<string, string>;
const KEYS = ["name", "industry", "location", "website", "gstin", "contactName", "contactTitle", "contactEmail", "contactPhone",
  "feePercent", "billingAfterDays", "guaranteeDays", "agreementStart", "agreementEnd", "status", "notes"];

export default function ClientForm({ id, initial, defaults, onDone }: {
  id?: string; initial?: ClientValues; defaults: { billingAfterDays: number; guaranteeDays: number }; onDone?: () => void;
}) {
  const router = useRouter();
  const [v, setV] = useState<ClientValues>(() => Object.fromEntries(KEYS.map((k) => [k, initial?.[k] ?? (k === "status" ? "Active" : "")])));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const c = await api<{ id: string }>(id ? `/api/clients/${id}` : "/api/clients", { method: id ? "PATCH" : "POST", json: v });
      if (onDone) { onDone(); router.refresh(); } else router.push(`/clients/${c.id}`);
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }

  const F = ({ k, label, type = "text", ph, span }: { k: string; label: string; type?: string; ph?: string; span?: boolean }) => (
    <div className={span ? "sm:col-span-2" : ""}><label className="label" htmlFor={`cf-${k}`}>{label}</label>
      <input id={`cf-${k}`} type={type} className="input" value={v[k]} onChange={set(k)} placeholder={ph} step={type === "number" ? "any" : undefined} /></div>
  );

  return (
    <form onSubmit={save} className="space-y-4">
      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold">Company</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2"><label className="label" htmlFor="cf-name">Client name *</label><input id="cf-name" required minLength={2} className="input" value={v.name} onChange={set("name")} placeholder="e.g. Acme Fintech Pvt Ltd" /></div>
          <div><label className="label" htmlFor="cf-status">Status</label><select id="cf-status" className="input" value={v.status} onChange={set("status")}>{CLIENT_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className="label" htmlFor="cf-industry">Industry</label>
            <input id="cf-industry" list="cf-industries" className="input" value={v.industry} onChange={set("industry")} /><datalist id="cf-industries">{INDUSTRIES.map((i) => <option key={i} value={i} />)}</datalist></div>
          {F({ k: "location", label: "City / location", ph: "Bengaluru" })}
          {F({ k: "website", label: "Website", ph: "acme.in" })}
          {F({ k: "gstin", label: "GSTIN", ph: "29ABCDE1234F1Z5" })}
        </div>
      </section>
      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold">Main contact</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {F({ k: "contactName", label: "Name" })}
          {F({ k: "contactTitle", label: "Designation", ph: "HR Head" })}
          {F({ k: "contactEmail", label: "Email", type: "email" })}
          {F({ k: "contactPhone", label: "Phone", type: "tel" })}
        </div>
      </section>
      <section className="card p-5">
        <h2 className="mb-1 text-sm font-semibold">Agreement &amp; terms</h2>
        <p className="mb-3 text-xs text-slate-400">Leave the day fields empty to use your workspace defaults ({defaults.billingAfterDays} days to bill, {defaults.guaranteeDays}-day guarantee).</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {F({ k: "feePercent", label: "Placement fee (% of annual CTC)", type: "number", ph: "8.33" })}
          {F({ k: "billingAfterDays", label: "Bill after (days)", type: "number", ph: String(defaults.billingAfterDays) })}
          {F({ k: "guaranteeDays", label: "Guarantee period (days)", type: "number", ph: String(defaults.guaranteeDays) })}
          {F({ k: "agreementStart", label: "Agreement start", type: "date" })}
          {F({ k: "agreementEnd", label: "Agreement end", type: "date" })}
        </div>
        <div className="mt-3"><label className="label" htmlFor="cf-notes">Notes</label><textarea id="cf-notes" rows={3} className="input" value={v.notes} onChange={set("notes")} placeholder="Hiring focus, payment terms, invoicing contact…" /></div>
      </section>
      {err && <p className="text-sm text-red-300">{err}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : id ? "Save changes" : "Add client"}</button>
        <button type="button" className="btn-ghost" onClick={() => (onDone ? onDone() : router.back())}>Cancel</button>
      </div>
    </form>
  );
}

export function ClientActions({ id, name, initial, defaults, canEdit, canDelete }: {
  id: string; name: string; initial: ClientValues; defaults: { billingAfterDays: number; guaranteeDays: number }; canEdit: boolean; canDelete: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  async function del() {
    if (!confirm(`Delete ${name}? Candidates keep the client name in their history.`)) return;
    try { await api(`/api/clients/${id}`, { method: "DELETE" }); router.push("/clients"); router.refresh(); } catch (e) { alert((e as Error).message); }
  }
  if (editing) return <div className="mt-4"><ClientForm id={id} initial={initial} defaults={defaults} onDone={() => setEditing(false)} /></div>;
  return (
    <div className="flex gap-2">
      {canEdit && <button className="btn-secondary" onClick={() => setEditing(true)}>Edit client</button>}
      {canDelete && <button className="btn-danger" onClick={del}>Delete</button>}
    </div>
  );
}
