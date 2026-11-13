import Link from "next/link";

const fmt = (v: number) => v.toLocaleString("en-IN");

export function StatTile({ label, value, sub, href }: { label: string; value: string; sub?: React.ReactNode; href?: string }) {
  const body = (
    <>
      <div className="text-xs font-medium tracking-wide text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-slate-100">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="card block p-5 transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-brand-400">{body}</Link>
  ) : <div className="card p-5">{body}</div>;
}

export function Panel({ title, sub, children, className = "" }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card p-5 ${className}`}>
      <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Horizontal bars, one hue (magnitude only). Each row shows its count and share, and links to the filtered list. */
export function BarList({ rows, total, empty = "No data yet" }: { rows: { label: string; value: number; href?: string }[]; total: number; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.some((r) => r.value)) return <p className="text-sm text-slate-400">{empty}</p>;
  return (
    <ul className="space-y-1">
      {rows.map((r) => {
        const pct = total ? Math.round((r.value / total) * 100) : 0;
        const inner = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-slate-200">{r.label}</span>
              <span className="shrink-0 tabular-nums text-slate-300">{fmt(r.value)} <span className="text-xs text-slate-400">· {pct}%</span></span>
            </div>
            <div className="neu-in-sm mt-1.5 h-2.5 rounded-full p-[2px]">
              <div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400 transition-[filter] group-hover:brightness-125"
                style={{ width: `${r.value ? Math.max(3, (r.value / max) * 100) : 0}%` }} />
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
            <div className="w-full max-w-9 rounded-t-[4px] bg-gradient-to-t from-brand-600 to-brand-400 transition group-hover:brightness-125 group-focus:brightness-125"
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
