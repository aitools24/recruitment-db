"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export default function Nav({ links, company, userName, roleLabel }: { links: { href: string; label: string }[]; company: string; userName: string; roleLabel: string }) {
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
    <aside className="border-b border-gray-200 bg-white md:sticky md:top-0 md:flex md:h-screen md:w-56 md:flex-col md:border-r md:border-b-0">
      <div className="flex items-center justify-between px-4 py-3 md:block">
        <div>
          <div className="text-lg font-bold text-brand-700">TalentBase</div>
          <div className="truncate text-xs text-gray-500">{company}</div>
        </div>
        <button className="btn-ghost md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">☰</button>
      </div>
      <nav className={`${open ? "block" : "hidden"} px-2 pb-2 md:block md:flex-1`}>
        {links.map((l) => (
          <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
            className={`block rounded-md px-3 py-2 text-sm ${active(l.href) ? "bg-brand-50 font-medium text-brand-700" : "text-gray-700 hover:bg-gray-50"}`}>
            {l.label}
          </Link>
        ))}
      </nav>
      <div className={`${open ? "block" : "hidden"} border-t border-gray-100 px-4 py-3 md:block`}>
        <div className="truncate text-sm font-medium">{userName}</div>
        <div className="text-xs text-gray-500">{roleLabel}</div>
        <button onClick={logout} className="mt-2 text-xs text-gray-500 hover:text-gray-800 hover:underline">Sign out</button>
      </div>
    </aside>
  );
}
