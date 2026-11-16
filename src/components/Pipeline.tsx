"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "./api";
import { STAGES, stageIndex, stageInfo } from "@/lib/pipeline";

export type PipelineProps = {
  id: string;
  canEdit: boolean;
  stage: string | null;
  clientId: string | null;
  clientName: string | null;
  clients: { id: string; name: string; status: string }[];
  canAddClient: boolean;
  jobTitle: string | null;
  interviewAt: string | null; // ISO
  offerCtc: number | null;
  joiningDate: string | null; // YYYY-MM-DD
  billedOn: string | null;    // YYYY-MM-DD
  billingAmount: number | null;
  terms: { billingAfterDays: number; guaranteeDays: number };
  history: { id: string; from: string | null; to: string | null; note: string | null; user: string; at: string }[];
};

const ymdLabel = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const istInput = (iso: string) => new Date(new Date(iso).getTime() + 330 * 60000).toISOString().slice(0, 16); // datetime-local in IST
const inr = (v: number) => `₹${v.toLocaleString("en-IN")}`;

export function PipelineCard(p: PipelineProps) {
  const cur = stageIndex(p.stage);
  const [editing, setEditing] = useState<string | null>(null); // stage key being moved to, or "" for details only
  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Placement pipeline</h2>
          <p className="text-xs text-slate-400">
            {p.stage ? [p.jobTitle, p.clientName].filter(Boolean).join(" at ") || "Client not recorded" : "Not submitted for any job yet."}
          </p>
        </div>
        {p.canEdit && !editing && (
          <div className="flex gap-2">
            {p.stage && <button className="btn-ghost text-xs" onClick={() => setEditing(p.stage!)}>Edit details</button>}
            {cur < STAGES.length - 1 && (
              <button className="btn-primary text-xs" onClick={() => setEditing(STAGES[cur + 1].key)}>
                {p.stage ? `Move to ${STAGES[cur + 1].short}` : "Start pipeline"}
              </button>
            )}
          </div>
        )}
      </div>

      <Stepper current={cur} onPick={p.canEdit ? (k) => setEditing(k) : undefined} />

      {p.stage && <Details {...p} />}
      {p.joiningDate && <Timers joiningDate={p.joiningDate} billedOn={p.billedOn} terms={p.terms} />}
      {editing !== null && <MoveForm {...p} target={editing} onClose={() => setEditing(null)} />}
      {p.history.length > 0 && <History items={p.history} />}
    </section>
  );
}

function Stepper({ current, onPick }: { current: number; onPick?: (k: string) => void }) {
  return (
    <ol className="grid grid-cols-3 gap-y-4 sm:grid-cols-6">
      {STAGES.map((s, i) => {
        const done = i < current, now = i === current;
        return (
          <li key={s.key} className="relative flex flex-col items-center text-center">
            {i > 0 && <span className="absolute right-1/2 top-4 hidden h-0.5 w-full -translate-y-1/2 sm:block" style={{ background: i <= current ? STAGES[i].color : "#334155" }} aria-hidden />}
            <button type="button" disabled={!onPick} onClick={() => onPick?.(s.key)} title={onPick ? `Move to ${s.label}` : s.label}
              className={`relative z-[1] flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition ${onPick ? "hover:scale-110" : "cursor-default"}`}
              style={done || now
                ? { background: s.color, color: "#fff", boxShadow: now ? `0 0 0 4px #1f2633, 0 0 16px 2px ${s.color}` : undefined }
                : { background: "#1a202b", color: "#94a3b8", boxShadow: "inset 2px 2px 4px #141922, inset -2px -2px 4px #2a3346" }}>
              {done ? "✓" : i + 1}
            </button>
            <span className={`mt-2 px-1 text-[11px] leading-tight ${now ? "font-semibold text-slate-100" : done ? "text-slate-300" : "text-slate-400"}`}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Details(p: PipelineProps) {
  const rows: [string, React.ReactNode][] = [
    ["Client", p.clientName && (p.clientId ? <Link href={`/clients/${p.clientId}`} className="text-brand-300 hover:underline">{p.clientName}</Link> : p.clientName)],
    ["Position", p.jobTitle],
    ["Interview", p.interviewAt && new Date(p.interviewAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })],
    ["Offered CTC", p.offerCtc !== null ? `${p.offerCtc} LPA` : null],
    ["Joining date", p.joiningDate && ymdLabel(p.joiningDate)],
    ["Billed on", p.billedOn && ymdLabel(p.billedOn)],
    ["Billing amount", p.billingAmount !== null ? inr(p.billingAmount) : null],
  ];
  const shown = rows.filter(([, v]) => v);
  if (!shown.length) return null;
  return (
    <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
      {shown.map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-xs text-slate-400">{k}</dt><dd className="truncate text-slate-100" title={typeof v === "string" ? v : undefined}>{v}</dd></div>)}
    </dl>
  );
}

/** Live countdown to an IST calendar date (midnight India time). */
function useNow(ms = 30000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}
const plusDaysLabel = (ymd: string, n: number) => ymdLabel(new Date(new Date(`${ymd}T00:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10));
const istMidnight = (ymd: string, plusDays: number) => new Date(`${ymd}T00:00:00+05:30`).getTime() + plusDays * 86400000;
function left(ms: number) {
  const m = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  return d > 0 ? `${d}d ${h}h ${mm}m` : `${h}h ${mm}m`;
}

function Timers({ joiningDate, billedOn, terms }: { joiningDate: string; billedOn: string | null; terms: PipelineProps["terms"] }) {
  const now = useNow();
  if (now === null) return <div className="mt-5 h-36" />;
  const start = istMidnight(joiningDate, 0);
  const billAt = istMidnight(joiningDate, terms.billingAfterDays);
  const endAt = istMidnight(joiningDate, terms.guaranteeDays);
  const day = Math.floor((now - start) / 86400000) + 1; // day 1 = joining day

  let headline: React.ReactNode, tone: string;
  if (now < start) { headline = <>Joins in <b>{left(start - now)}</b></>; tone = "#9085e9"; }
  else if (!billedOn && now < billAt) { headline = <>Day {day} since joining · billing opens in <b>{left(billAt - now)}</b></>; tone = "#c98500"; }
  else if (!billedOn) { headline = <><b>Ready to bill.</b> {terms.billingAfterDays} days completed on {plusDaysLabel(joiningDate, terms.billingAfterDays)}</>; tone = "#e66767"; }
  else if (now < endAt) { headline = <>Billed · guarantee ends in <b>{left(endAt - now)}</b></>; tone = "#3987e5"; }
  else { headline = <><b>Guarantee period complete.</b> This placement is safe.</>; tone = "#0ca30c"; }

  return (
    <div className="neu-in mt-5 rounded-2xl p-4">
      <div className="flex items-center gap-2 text-sm text-slate-200">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: tone, boxShadow: `0 0 10px ${tone}` }} aria-hidden />
        <span>{headline}</span>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Bar label={`Billing after ${terms.billingAfterDays} days`} start={start} end={billAt} now={now} color="#c98500" doneText={billedOn ? `Billed ${ymdLabel(billedOn)}` : "Eligible now"} foot={`Can bill from ${plusDaysLabel(joiningDate, terms.billingAfterDays)}`} />
        <Bar label={`Guarantee period (${terms.guaranteeDays} days)`} start={start} end={endAt} now={now} color="#3987e5" doneText="Completed" foot={`Last day ${plusDaysLabel(joiningDate, terms.guaranteeDays - 1)}`} />
      </div>
    </div>
  );
}

function Bar({ label, start, end, now, color, doneText, foot }: { label: string; start: number; end: number; now: number; color: string; doneText: string; foot: string }) {
  const pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  const done = now >= end;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="tabular-nums font-medium" style={{ color: done ? "#4ade80" : color }}>{done ? doneText : now < start ? "Not started" : `${left(end - now)} left`}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#161b25] shadow-[inset_1px_1px_3px_#0e1218]">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: done ? "#22c55e" : `linear-gradient(90deg, ${color}99, ${color})` }} />
      </div>
      <div className="mt-1 text-[11px] text-slate-400">{foot}</div>
    </div>
  );
}

function MoveForm(p: PipelineProps & { target: string; onClose: () => void }) {
  const router = useRouter();
  const [stage, setStage] = useState(p.target);
  const [f, setF] = useState({
    clientId: p.clientId ?? "", jobTitle: p.jobTitle ?? "",
    interviewAt: p.interviewAt ? istInput(p.interviewAt) : "", offerCtc: p.offerCtc?.toString() ?? "",
    joiningDate: p.joiningDate ?? "", billedOn: p.billedOn ?? "", billingAmount: p.billingAmount?.toString() ?? "", note: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [clients, setClients] = useState(p.clients);
  const [newClient, setNewClient] = useState<string | null>(null);
  const idx = stageIndex(stage);
  async function addClient() {
    if (!newClient?.trim()) return;
    try {
      const c = await api<{ id: string; name: string; status: string }>("/api/clients", { method: "POST", json: { name: newClient } });
      setClients([...clients, c].sort((a, b) => a.name.localeCompare(b.name)));
      setF((x) => ({ ...x, clientId: c.id }));
      setNewClient(null); setErr("");
    } catch (x) { setErr((x as Error).message); }
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await api(`/api/candidates/${p.id}/stage`, {
        method: "POST",
        json: {
          stage, note: f.note || undefined,
          clientId: f.clientId || null, jobTitle: f.jobTitle,
          interviewAt: f.interviewAt || null, offerCtc: num(f.offerCtc),
          joiningDate: f.joiningDate || null, billedOn: f.billedOn || null, billingAmount: num(f.billingAmount),
        },
      });
      p.onClose(); router.refresh();
    } catch (x) { setErr((x as Error).message); }
    setBusy(false);
  }
  async function remove() {
    if (!confirm("Remove this candidate from the pipeline? Their stage history is kept.")) return;
    try { await api(`/api/candidates/${p.id}/stage`, { method: "POST", json: { stage: null } }); p.onClose(); router.refresh(); } catch (x) { setErr((x as Error).message); }
  }

  return (
    <form onSubmit={save} className="neu-in mt-5 space-y-3 rounded-2xl p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <label className="label">Stage</label>
          <select className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
            {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>
        <span className="accent-chip mb-1.5" style={{ ["--accent" as string]: stageInfo(stage)?.color }}>{stage === p.stage ? "Current stage" : p.stage ? `From ${stageInfo(p.stage)?.short}` : "New"}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={`Client${idx >= 1 ? " *" : ""}`}>
          {newClient === null ? (
            <select className="input" value={f.clientId} onChange={(e) => (e.target.value === "__new" ? setNewClient("") : set("clientId")(e))}>
              <option value="">Choose a client…</option>
              {clients.filter((c) => c.status !== "Inactive" || c.id === f.clientId).map((c) => <option key={c.id} value={c.id}>{c.name}{c.status !== "Active" ? ` (${c.status})` : ""}</option>)}
              {p.canAddClient && <option value="__new">+ Add a new client…</option>}
            </select>
          ) : (
            <div className="flex gap-2">
              <input autoFocus className="input" value={newClient} onChange={(e) => setNewClient(e.target.value)} placeholder="New client's company name"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addClient(); } }} />
              <button type="button" className="btn-secondary" onClick={addClient}>Add</button>
              <button type="button" className="btn-ghost" onClick={() => setNewClient(null)}>×</button>
            </div>
          )}
        </Field>
        <Field label="Position"><input className="input" value={f.jobTitle} onChange={set("jobTitle")} placeholder="e.g. Senior Java Developer" /></Field>
        {idx >= 2 && <Field label="Interview date and time"><input type="datetime-local" className="input" value={f.interviewAt} onChange={set("interviewAt")} /></Field>}
        {idx >= 3 && <Field label="Offered CTC (LPA)"><input type="number" step="0.1" min="0" className="input" value={f.offerCtc} onChange={set("offerCtc")} /></Field>}
        {idx >= 3 && <Field label={`Joining date${idx >= 4 ? " *" : ""}`} hint="The billing and guarantee timers start from this date."><input type="date" className="input" value={f.joiningDate} onChange={set("joiningDate")} required={idx >= 4} /></Field>}
        {idx >= 5 && <Field label="Billed on" hint="Leave empty to use today."><input type="date" className="input" value={f.billedOn} onChange={set("billedOn")} /></Field>}
        {idx >= 5 && <Field label="Billing amount (₹)"><input type="number" min="0" className="input" value={f.billingAmount} onChange={set("billingAmount")} /></Field>}
      </div>
      <Field label="Note (optional)"><textarea rows={2} className="input" value={f.note} onChange={set("note")} placeholder="Feedback, interview round, reason for the move…" /></Field>
      {err && <p className="text-sm text-red-300">{err}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn-primary" disabled={busy}>{busy ? "Saving…" : stage === p.stage ? "Save details" : `Move to ${stageInfo(stage)?.short}`}</button>
        <button type="button" className="btn-ghost" onClick={p.onClose}>Cancel</button>
        {p.stage && <button type="button" className="btn-ghost ml-auto text-xs text-red-300" onClick={remove}>Remove from pipeline</button>}
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div><label className="label">{label}</label>{children}{hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}</div>;
}

function History({ items }: { items: PipelineProps["history"] }) {
  return (
    <details className="mt-5">
      <summary className="cursor-pointer text-sm text-brand-300">Stage history ({items.length})</summary>
      <ol className="mt-3 space-y-3 border-l border-white/[0.08] pl-4 text-sm">
        {items.map((h) => {
          const to = stageInfo(h.to);
          return (
            <li key={h.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full" style={{ background: to?.color ?? "#64748b" }} aria-hidden />
              <div className="text-slate-100">{h.from === h.to ? "Note" : to ? to.label : "Removed from pipeline"}</div>
              {h.note && <p className="whitespace-pre-wrap text-slate-300">{h.note}</p>}
              <div className="text-xs text-slate-400">{h.user} · {h.at}</div>
            </li>
          );
        })}
      </ol>
    </details>
  );
}
