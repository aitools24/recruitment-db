"use client";

import Link from "next/link";
import { useState } from "react";
import { STAGES } from "@/lib/pipeline";

type Tip = { x: number; y: number; title: string; lines: string[] } | null;

function Tooltip({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return (
    <div className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-[#0f141c] px-3 py-2 text-xs shadow-[0_6px_18px_#0b0e14] ring-1 ring-white/10"
      style={{ left: tip.x, top: tip.y - 8 }}>
      <div className="font-semibold text-slate-100">{tip.title}</div>
      {tip.lines.map((l) => <div key={l} className="text-slate-300">{l}</div>)}
    </div>
  );
}

const pos = (e: React.MouseEvent, box: HTMLElement | null) => {
  const r = box?.getBoundingClientRect();
  return r ? { x: e.clientX - r.left, y: e.clientY - r.top } : { x: 0, y: 0 };
};

/** Column per stage (magnitude), each in its stage colour. Count on top, click to see those candidates. */
export function StageColumns({ counts }: { counts: Record<string, number> }) {
  const [tip, setTip] = useState<Tip>(null);
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...Object.values(counts));
  return (
    <div ref={setBox} className="relative" onMouseLeave={() => setTip(null)}>
      <div className="flex h-48 items-end gap-2 border-b border-white/[0.08] px-1 sm:gap-3">
        {STAGES.map((s) => {
          const v = counts[s.key] ?? 0;
          return (
            <Link key={s.key} href={`/candidates?stage=${s.key}`} aria-label={`${s.label}: ${v}`}
              className="group flex h-full flex-1 flex-col items-center justify-end"
              onMouseMove={(e) => setTip({ ...pos(e, box), title: s.label, lines: [`${v} candidate${v === 1 ? "" : "s"}`, total ? `${Math.round((v / total) * 100)}% of pipeline` : ""].filter(Boolean) })}>
              <span className="mb-1 text-sm font-semibold tabular-nums text-slate-200">{v}</span>
              <span className="w-full max-w-14 rounded-t-[4px] transition group-hover:brightness-125"
                style={{ height: `${v ? Math.max(4, (v / max) * 100) : 0}%`, background: s.color, maxHeight: "calc(100% - 1.5rem)" }} />
            </Link>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 px-1 sm:gap-3">
        {STAGES.map((s) => <div key={s.key} className="flex-1 text-center text-[11px] leading-tight text-slate-400">{s.short}</div>)}
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}

/** One stacked bar per client: how its candidates split across stages. */
export function ClientStacks({ rows }: { rows: { id: string | null; name: string; counts: Record<string, number> }[] }) {
  const [tip, setTip] = useState<Tip>(null);
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const max = Math.max(1, ...rows.map((r) => Object.values(r.counts).reduce((a, b) => a + b, 0)));
  if (!rows.length) return <p className="text-sm text-slate-400">No clients in the pipeline yet.</p>;
  return (
    <div ref={setBox} className="relative" onMouseLeave={() => setTip(null)}>
      <Legend />
      <ul className="mt-4 space-y-3">
        {rows.map((r) => {
          const total = Object.values(r.counts).reduce((a, b) => a + b, 0);
          return (
            <li key={r.name}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                {r.id ? <Link href={`/clients/${r.id}`} className="truncate text-slate-200 hover:text-brand-300 hover:underline">{r.name}</Link> : <span className="truncate text-slate-200">{r.name}</span>}
                <span className="shrink-0 tabular-nums text-slate-300">{total}</span>
              </div>
              <div className="flex h-3.5 gap-[2px]" style={{ width: `${(total / max) * 100}%` }}>
                {STAGES.filter((s) => r.counts[s.key]).map((s, i, arr) => (
                  <span key={s.key} className={`h-full transition hover:brightness-125 ${i === 0 ? "rounded-l-[4px]" : ""} ${i === arr.length - 1 ? "rounded-r-[4px]" : ""}`}
                    style={{ flexGrow: r.counts[s.key], flexBasis: 0, background: s.color, minWidth: 4 }}
                    onMouseMove={(e) => setTip({ ...pos(e, box), title: `${r.name} · ${s.label}`, lines: [`${r.counts[s.key]} of ${total} candidate${total === 1 ? "" : "s"}`] })} />
                ))}
              </div>
            </li>
          );
        })}
      </ul>
      <Tooltip tip={tip} />
    </div>
  );
}

export function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-300">
      {STAGES.map((s) => <li key={s.key} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />{s.short}</li>)}
    </ul>
  );
}

/** Average days candidates have been sitting in their current stage (one series, one hue). */
export function DaysInStage({ rows }: { rows: { key: string; label: string; avg: number | null; n: number }[] }) {
  const [tip, setTip] = useState<Tip>(null);
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.avg ?? 0));
  return (
    <div ref={setBox} className="relative" onMouseLeave={() => setTip(null)}>
      <ul className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.key} onMouseMove={(e) => setTip({ ...pos(e, box), title: r.label, lines: r.avg === null ? ["Nobody in this stage"] : [`Average ${r.avg} day${r.avg === 1 ? "" : "s"} in stage`, `${r.n} candidate${r.n === 1 ? "" : "s"}`] })}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate text-slate-200">{r.label}</span>
              <span className="shrink-0 tabular-nums text-slate-300">{r.avg === null ? "—" : `${r.avg}d`}</span>
            </div>
            <div className="neu-in-sm h-2.5 rounded-full p-[2px]">
              <div className="h-full rounded-full" style={{ width: `${r.avg ? Math.max(3, (r.avg / max) * 100) : 0}%`, background: "linear-gradient(90deg, color-mix(in oklab, #9085e9 65%, #0f172a), #9085e9)" }} />
            </div>
          </li>
        ))}
      </ul>
      <Tooltip tip={tip} />
    </div>
  );
}
