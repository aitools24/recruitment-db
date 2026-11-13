"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "./icons";

export default function Nav({ links, company, userName, roleLabel }: { links: { href: string; label: string; icon: string; color: string }[]; company: string; userName: string; roleLabel: string }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/candidates" ? path === "/candidates" || (path.startsWith("/candidates/") && !path.startsWith("/candidates/new")) : path.startsWith(href));
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }
  return (
    <aside className="relative z-10 bg-surface shadow-[0_6px_14px_#141922] md:sticky md:top-0 md:flex md:h-screen md:w-60 md:flex-col md:shadow-[6px_0_18px_#141922]">
      <div className="flex items-center justify-between px-4 py-4 md:block md:px-5 md:py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#3987e5] via-[#9085e9] to-[#d55181] text-lg font-bold text-white shadow-[4px_4px_10px_#141922,-3px_-3px_8px_#2a3346]">T</div>
          <div className="min-w-0">
            <div className="text-base font-semibold tracking-tight text-slate-100">TalentBase</div>
            <div className="truncate text-xs text-slate-400">{company}</div>
          </div>
        </div>
        <button className="btn-secondary md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">☰</button>
      </div>
      <nav className={`${open ? "block" : "hidden"} space-y-1.5 px-3 pb-3 md:block md:flex-1 md:px-4`}>
        {links.map((l) => (
          <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
            className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm transition ${active(l.href) ? "neu-in-sm font-medium text-brand-300" : "text-slate-300 hover:text-white hover:bg-white/[0.02]"}`}>
            <span className="accent-badge flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ ["--accent" as string]: l.color, ...(active(l.href) ? { boxShadow: `0 0 12px -2px ${l.color}` } : {}) }}><Icon name={l.icon} className="h-4 w-4" /></span>
            {l.label}
          </Link>
        ))}
      </nav>
      <div className={`${open ? "block" : "hidden"} px-4 pb-4 md:block`}>
        <div className="neu-in-sm rounded-xl px-3.5 py-3">
        <div className="truncate text-sm font-medium">{userName}</div>
        <div className="text-xs text-slate-400">{roleLabel}</div>
        <button onClick={logout} className="mt-2 text-xs text-slate-400 hover:text-slate-100 hover:underline">Sign out</button>
        </div>
      </div>
    </aside>
  );
}
