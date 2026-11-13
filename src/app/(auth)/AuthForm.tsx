"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/components/api";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api(`/api/auth/${mode}`, { method: "POST", json: Object.fromEntries(new FormData(e.currentTarget)) });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#3987e5] via-[#9085e9] to-[#d55181] text-2xl font-bold text-white shadow-[6px_6px_14px_#141922,-5px_-5px_12px_#2a3346]">T</div>
          <div className="text-2xl font-semibold tracking-tight text-slate-100">TalentBase</div>
          <p className="mt-1 text-sm text-slate-400">{mode === "login" ? "Sign in to your candidate database" : "Create a workspace for your recruitment team"}</p>
        </div>
        <form onSubmit={submit} className="card space-y-4 p-7">
          {mode === "signup" && (
            <>
              <div><label className="label">Company name</label><input name="company" required minLength={2} className="input" /></div>
              <div><label className="label">Your name</label><input name="name" required minLength={2} className="input" /></div>
            </>
          )}
          <div><label className="label">Work email</label><input name="email" type="email" required className="input" autoComplete="email" /></div>
          <div>
            <label className="label">Password</label>
            <input name="password" type="password" required minLength={mode === "signup" ? 8 : 1} className="input" autoComplete={mode === "login" ? "current-password" : "new-password"} />
            {mode === "signup" && <p className="mt-1 text-xs text-slate-400">At least 8 characters.</p>}
          </div>
          {error && <p className="neu-in-sm rounded-xl px-2 py-1.5 text-sm text-red-300">{error}</p>}
          <button className="btn-primary w-full py-2.5" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create workspace"}</button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-400">
          {mode === "login" ? <>New here? <Link href="/signup" className="text-brand-300 hover:underline">Create a workspace</Link></> : <>Already have an account? <Link href="/login" className="text-brand-300 hover:underline">Sign in</Link></>}
        </p>
      </div>
    </div>
  );
}
