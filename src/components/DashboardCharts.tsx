import Link from "next/link";
import { Icon } from "./icons";

const fmt = (v: number) => v.toLocaleString("en-IN");

export function StatTile({ label, value, sub, href, icon, color }: { label: string; value: string; sub?: React.ReactNode; href?: string; icon: string; color: string }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium tracking-wide text-slate-400">{label}</div>
        <span className="accent-badge flex h-9 w-9 items-center justify-center rounded-xl" style={{ ["--accent" as string]: color }}><Icon name={icon} className="h-[18px] w-[18px]" /></span>
      </div>
      <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-slate-100">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="card relative block overflow-hidden p-5 transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-brand-400"><Stripe color={color} />{body}</Link>
  ) : <div className="card relative overflow-hidden p-5"><Stripe color={color} />{body}</div>;
}

function Stripe({ color }: { color: string }) {
  return <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />;
}

export function Panel({ title, sub, children, className = "", color }: { title: string; sub?: string; children: React.ReactNode; className?: string; color?: string }) {
  return (
    <section className={`card p-5 ${className}`}>
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
        {color && <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />}
        {title}
      </h2>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Horizontal bars, one hue (magnitude only). Each row shows its count and share, and links to the filtered list. */
/** `color` is the panel hue; a row may override it with its own entity colour (categorical). */
export function BarList({ rows, total, empty = "No data yet", color = "#3987e5" }: { rows: { label: string; value: number; href?: string; color?: string }[]; total: number; empty?: string; color?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.some((r) => r.value)) return <p className="text-sm text-slate-400">{empty}</p>;
  return (
    <ul className="space-y-1">
      {rows.map((r) => {
        const pct = total ? Math.round((r.value / total) * 100) : 0;
        const inner = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 truncate text-slate-200">{r.color && <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: r.color }} />}{r.label}</span>
              <span className="shrink-0 tabular-nums text-slate-300">{fmt(r.value)} <span className="text-xs text-slate-400">· {pct}%</span></span>
            </div>
            <div className="neu-in-sm mt-1.5 h-2.5 rounded-full p-[2px]">
              <div className="h-full rounded-full transition-[filter] group-hover:brightness-125"
                style={{ width: `${r.value ? Math.max(3, (r.value / max) * 100) : 0}%`, background: `linear-gradient(90deg, color-mix(in oklab, ${r.color ?? color} 65%, #0f172a), ${r.color ?? color})` }} />
            </div>
          </>
        );
        return (
          <li key={r.label}>
            {r.href ? (
              <Link href={r.href} title={`${r.label}: ${fmt(r.value)} candidates (${pct}%). Click to see them.`}
                className="group block rounded-xl px-2 py-1.5 transition hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-brand-400">{inner}</Link>
            ) : <div className="group px-2 py-1.5" title={`${r.label}: ${fmt(r.value)} candidates (${pct}%)`}>{inner}</div>}
          </li>
        );
      })}
    </ul>
  );
}

/** Candidates added per week (last 12 weeks). One series, so the title names it and there's no legend. */
export function WeeklyColumns({ data }: { data: { week: Date; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const label = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return (
    <div>
      <div className="neu-in relative flex h-44 items-end gap-[2px] rounded-2xl px-3 pt-6 pb-0">
        {data.map((d, i) => (
          <div key={i} className="group relative flex h-full flex-1 items-end justify-center" tabIndex={0}
            aria-label={`Week of ${label(d.week)}: ${d.value} candidates added`}>
            <div className="w-full max-w-9 rounded-t-[4px] bg-gradient-to-t from-[#1f5fb8] via-[#3987e5] to-[#7aa9ff] transition group-hover:brightness-125 group-focus:brightness-125"
              style={{ height: `${d.value ? Math.max(3, (d.value / max) * 100) : 0}%` }} />
            <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 shadow-lg ring-1 ring-white/10 group-hover:block group-focus:block">
              <div className="text-slate-400">Week of {label(d.week)}</div>
              <div className="font-semibold tabular-nums">{d.value} added</div>
            </div>
          </div>
        ))}
        <div className="pointer-events-none absolute inset-x-3 bottom-0 h-px bg-white/10" />
      </div>
      <div className="mt-2 flex gap-[2px] px-3 text-[10px] text-slate-400">
        {data.map((d, i) => <div key={i} className="flex-1 text-center">{i % 3 === 0 || i === data.length - 1 ? label(d.week) : ""}</div>)}
      </div>
    </div>
  );
}
