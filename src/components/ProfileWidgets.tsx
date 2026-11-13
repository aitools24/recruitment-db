"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { api } from "./api";

export function TagEditor({ id, tags, canEdit }: { id: string; tags: string[]; canEdit: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(next: string[]) {
    setBusy(true);
    await api(`/api/candidates/${id}`, { method: "PATCH", json: { tags: next } }).catch((e) => alert(e.message));
    setValue("");
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <span key={t} className="chip-blue">#{t}{canEdit && <button disabled={busy} onClick={() => save(tags.filter((x) => x !== t))} className="ml-0.5 text-brand-300 hover:text-red-300" aria-label={`Remove ${t}`}>×</button>}</span>
      ))}
      {!tags.length && !canEdit && <span className="text-sm text-slate-400">No tags</span>}
      {canEdit && (
        <form onSubmit={(e) => { e.preventDefault(); if (value.trim()) save([...tags, ...value.split(",")]); }} className="flex gap-1">
          <input value={value} onChange={(e) => setValue(e.target.value)} className="input w-36 py-0.5 text-xs" placeholder="Add tag" />
          <button className="btn-secondary py-0.5 text-xs" disabled={busy || !value.trim()}>Add</button>
        </form>
      )}
    </div>
  );
}

export function NotesPanel({ id, notes, canEdit }: { id: string; notes: { id: string; body: string; author: string; createdAt: string }[]; canEdit: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/api/candidates/${id}/notes`, { method: "POST", json: { body } });
      setBody("");
      router.refresh();
    } catch (err) {
      alert((err as Error).message);
    }
    setBusy(false);
  }
  return (
    <section className="card p-5">
      <h2 className="mb-2 text-sm font-semibold">Notes</h2>
      {canEdit && (
        <form onSubmit={add} className="mb-3 space-y-2">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} className="input" placeholder="Call summary, interview feedback, availability…" />
          <button className="btn-primary" disabled={busy || !body.trim()}>Add note</button>
        </form>
      )}
      <ul className="space-y-3">
        {notes.map((n) => (
          <li key={n.id} className="text-sm">
            <p className="whitespace-pre-wrap">{n.body}</p>
            <div className="text-xs text-slate-400">{n.author} · {n.createdAt}</div>
          </li>
        ))}
        {!notes.length && <li className="text-sm text-slate-400">No notes yet.</li>}
      </ul>
    </section>
  );
}

export function ResumeUpload({ id }: { id: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function upload(file: File) {
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      await api(`/api/candidates/${id}/resumes`, { method: "POST", body: fd });
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  }
  return (
    <>
      <input ref={input} type="file" accept=".pdf,.docx,.txt" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <button className="btn-secondary" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Uploading…" : "Upload new version"}</button>
    </>
  );
}

export function DeleteCandidate({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  async function del() {
    if (!confirm(`Delete ${name} permanently? Their resumes and notes are deleted too.`)) return;
    try {
      await api(`/api/candidates/${id}`, { method: "DELETE" });
      router.push("/candidates");
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
    }
  }
  return <button className="btn-danger" onClick={del}>Delete</button>;
}
