"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";

const ROLES = [["ADMIN", "Admin"], ["MANAGER", "Manager"], ["RECRUITER", "Recruiter"], ["VIEWER", "View-only"]] as const;
type U = { id: string; name: string; email: string; role: string; active: boolean };

export function TeamManager({ users, me, isAdmin }: { users: U[]; me: string; isAdmin: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  async function patch(id: string, json: object) {
    try { await api(`/api/users/${id}`, { method: "PATCH", json }); router.refresh(); } catch (e) { alert((e as Error).message); }
  }
  async function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = e.currentTarget;
    try {
      await api("/api/users", { method: "POST", json: Object.fromEntries(new FormData(form)) });
      form.reset(); setAdding(false); router.refresh();
    } catch (err) { setError((err as Error).message); }
  }
  async function resetPassword(u: U) {
    const pw = prompt(`New temporary password for ${u.name} (8+ characters):`);
    if (pw) await patch(u.id, { password: pw });
  }
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[560px]">
        <thead className="border-b border-gray-200 bg-gray-50"><tr><th className="th">Name</th><th className="th">Email</th><th className="th">Role</th><th className="th">Status</th>{isAdmin && <th className="th"></th>}</tr></thead>
        <tbody className="divide-y divide-gray-100">
          {users.map((u) => (
            <tr key={u.id} className={u.active ? "" : "text-gray-400"}>
              <td className="td">{u.name}{u.id === me && <span className="ml-1 text-xs text-gray-400">(you)</span>}</td>
              <td className="td">{u.email}</td>
              <td className="td">
                {isAdmin && u.id !== me ? (
                  <select className="input w-auto py-0.5" value={u.role} onChange={(e) => patch(u.id, { role: e.target.value })}>{ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                ) : ROLES.find(([k]) => k === u.role)?.[1]}
              </td>
              <td className="td">{u.active ? "Active" : "Deactivated"}</td>
              {isAdmin && (
                <td className="td whitespace-nowrap text-right">
                  {u.id !== me && <button className="btn-ghost text-xs" onClick={() => patch(u.id, { active: !u.active })}>{u.active ? "Deactivate" : "Reactivate"}</button>}
                  <button className="btn-ghost text-xs" onClick={() => resetPassword(u)}>Reset password</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {isAdmin && (
        <div className="border-t border-gray-100 p-3">
          {adding ? (
            <form onSubmit={add} className="grid gap-2 sm:grid-cols-5">
              <input name="name" required minLength={2} placeholder="Name" className="input" />
              <input name="email" type="email" required placeholder="Email" className="input" />
              <select name="role" className="input" defaultValue="RECRUITER">{ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <input name="password" required minLength={8} placeholder="Temporary password" className="input" />
              <div className="flex gap-1"><button className="btn-primary">Add</button><button type="button" className="btn-ghost" onClick={() => setAdding(false)}>Cancel</button></div>
              {error && <p className="text-sm text-red-700 sm:col-span-5">{error}</p>}
              <p className="text-xs text-gray-500 sm:col-span-5">Share the temporary password with them privately. They can change it under My account after signing in.</p>
            </form>
          ) : <button className="btn-secondary" onClick={() => setAdding(true)}>+ Add team member</button>}
        </div>
      )}
    </div>
  );
}

export function ExportSettings({ isAdmin, roles, maxRows }: { isAdmin: boolean; roles: string[]; maxRows: number }) {
  const router = useRouter();
  const [sel, setSel] = useState(roles);
  const [max, setMax] = useState(String(maxRows));
  const [saved, setSaved] = useState(false);
  async function save() {
    try {
      await api("/api/settings", { method: "PATCH", json: { exportRoles: sel, exportMaxRows: Number(max) } });
      setSaved(true); router.refresh();
    } catch (e) { alert((e as Error).message); }
  }
  return (
    <section className="card p-4">
      <h2 className="mb-1 text-sm font-semibold">Export controls</h2>
      <p className="mb-3 text-xs text-gray-600">Choose who can download candidate data as CSV/Excel, and the most rows one export can contain. Every export is recorded in the activity log.</p>
      <div className="flex flex-wrap gap-4 text-sm">
        {ROLES.map(([k, l]) => (
          <label key={k} className="flex items-center gap-1.5">
            <input type="checkbox" disabled={!isAdmin || k === "ADMIN"} checked={sel.includes(k)} onChange={(e) => { setSaved(false); setSel(e.target.checked ? [...sel, k] : sel.filter((x) => x !== k)); }} />{l}
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <div><label className="label">Max rows per export</label><input type="number" min={1} max={100000} disabled={!isAdmin} className="input w-36" value={max} onChange={(e) => { setSaved(false); setMax(e.target.value); }} /></div>
        {isAdmin && <button className="btn-primary" onClick={save}>Save</button>}
        {saved && <span className="text-sm text-green-700">Saved</span>}
      </div>
      {!isAdmin && <p className="mt-2 text-xs text-gray-500">Only Admins can change these.</p>}
    </section>
  );
}

export function MyAccount({ id, name }: { id: string; name: string }) {
  const [msg, setMsg] = useState("");
  async function change(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const pw = new FormData(form).get("password") as string;
    try { await api(`/api/users/${id}`, { method: "PATCH", json: { password: pw } }); setMsg("Password changed"); form.reset(); } catch (err) { setMsg((err as Error).message); }
  }
  return (
    <section className="card p-4">
      <h2 className="mb-2 text-sm font-semibold">My account</h2>
      <p className="mb-2 text-sm text-gray-600">Signed in as {name}.</p>
      <form onSubmit={change} className="flex flex-wrap items-end gap-2">
        <div><label className="label">New password</label><input name="password" type="password" minLength={8} required className="input w-56" autoComplete="new-password" /></div>
        <button className="btn-secondary">Change password</button>
        {msg && <span className="text-sm text-gray-600">{msg}</span>}
      </form>
    </section>
  );
}
