"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";

type C = { id: string; fullName: string; email: string | null; phone: string | null; role: string; details: string; owner: string; resumes: number; notes: number; added: string };

export default function DuplicateGroup({ kind, matchValue, candidates, canMerge }: { kind: string; matchValue: string; candidates: C[]; canMerge: boolean }) {
  const router = useRouter();
  const [primary, setPrimary] = useState(candidates[candidates.length - 1]?.id); // default: most recently added
  const [busy, setBusy] = useState(false);
  async function merge() {
    const others = candidates.filter((c) => c.id !== primary).map((c) => c.id);
    if (!confirm(`Merge ${others.length} profile(s) into the selected one? This can't be undone.`)) return;
    setBusy(true);
    try {
      await api("/api/duplicates/merge", { method: "POST", json: { primaryId: primary, otherIds: others } });
      router.refresh();
    } catch (e) {
      alert((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <section className="card p-4">
      <div className="mb-2 text-sm text-gray-600">Same {kind}: <span className="font-medium text-gray-900">{matchValue}</span></div>
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {candidates.map((c) => (
          <label key={c.id} className={`block cursor-pointer rounded-md border p-3 text-sm ${primary === c.id ? "border-brand-500 bg-brand-50" : "border-gray-200"}`}>
            {canMerge && <input type="radio" className="mr-2" checked={primary === c.id} onChange={() => setPrimary(c.id)} />}
            <Link href={`/candidates/${c.id}`} target="_blank" className="font-medium text-brand-700 hover:underline">{c.fullName}</Link>
            <div className="text-gray-600">{c.role}</div>
            <div className="text-gray-500">{[c.email, c.phone].filter(Boolean).join(" · ")}</div>
            <div className="text-gray-500">{c.details}</div>
            <div className="mt-1 text-xs text-gray-400">Added {c.added}{c.owner && ` by ${c.owner}`} · {c.resumes} resume(s) · {c.notes} note(s)</div>
          </label>
        ))}
      </div>
      {canMerge ? (
        <button className="btn-primary mt-3" disabled={busy} onClick={merge}>{busy ? "Merging…" : "Keep selected and merge the others into it"}</button>
      ) : <p className="mt-2 text-xs text-gray-500">Ask a Manager or Admin to merge these.</p>}
    </section>
  );
}
