import { Scale, ShieldAlert } from "lucide-react";
import type { ChiefOverride, GroupCConsensus, GroupCItem } from "@/lib/groupCConsensus";

const GREEN = "#34d399";
const RED = "#f87171";

function nextOverride(cur: ChiefOverride | null): ChiefOverride | null {
  return cur === null ? "YES" : cur === "YES" ? "NO" : null;
}

function DecisionLabel({ it, total }: { it: GroupCItem; total: number }) {
  if (it.override) {
    return <span className="text-amber-300">Chief override · {it.override}</span>;
  }
  if (it.majority === "SPLIT") return <span className="text-white/50">No majority · pending</span>;
  const n = it.majority === "YES" ? it.yes : it.no;
  return (
    <span style={{ color: it.majority === "YES" ? GREEN : RED }}>
      {it.majority === "YES" ? "Confirmed" : "Rejected"} by Majority {n}/{total}
    </span>
  );
}

/** Group C 2/3 majority board: per-judge badges, majority result, Chief override. */
export function GroupCConsensusPanel({
  consensus,
  onOverride,
}: {
  consensus: GroupCConsensus;
  onOverride: (item: GroupCItem, next: ChiefOverride | null) => void;
}) {
  const { items, slots, score } = consensus;
  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2" dir="ltr">
      <div className="flex items-center gap-2 mb-1.5">
        <Scale className="h-3.5 w-3.5 text-cyan-300" />
        <p className="text-[10px] font-black tracking-[0.25em] text-white/70">CONSENSUS · GROUP C (2/3)</p>
        <span className="ml-auto text-[9px] text-white/40 tabular-nums">
          {slots.length} judges · C = {score === null ? "—" : score.toFixed(3)}
        </span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 max-h-[96px]">
        {items.map((it) => {
          const color = it.decision === "YES" ? GREEN : it.decision === "NO" ? RED : "#94a3b8";
          return (
            <div
              key={it.key}
              className="shrink-0 rounded-lg border px-2 py-1 min-w-[150px]"
              style={{ borderColor: `${color}80`, background: `${color}14` }}
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black text-white tabular-nums">{it.code}</span>
                <span className="text-[9px] text-white/50 tabular-nums">
                  {it.kind === "connection" ? "conn" : "mov"} {it.value.toFixed(2)}
                </span>
                <button
                  type="button"
                  onClick={() => onOverride(it, nextOverride(it.override))}
                  title="Chief override (YES → NO → clear) — logged to audit trail"
                  className="ml-auto inline-flex items-center gap-0.5 rounded px-1 text-[9px] font-bold border border-amber-400/40 text-amber-300 hover:bg-amber-400/10"
                >
                  <ShieldAlert className="h-2.5 w-2.5" />
                  {it.override ?? "OVR"}
                </button>
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {slots.map((s) => {
                  const v = it.votes[s];
                  const minority = it.minority.includes(s) || (it.override !== null && v !== undefined && v !== it.override);
                  return (
                    <span
                      key={s}
                      className={`text-[9px] font-bold px-1 rounded tabular-nums ${minority ? "line-through opacity-40" : ""}`}
                      style={{
                        color: v === "YES" ? GREEN : v === "NO" ? RED : "#94a3b8",
                        background: "rgba(255,255,255,0.05)",
                      }}
                      title={minority ? "Overridden by majority rule" : undefined}
                    >
                      {s}: {v ?? "—"} {v === "YES" ? "🟢" : v === "NO" ? "🔴" : ""}
                    </span>
                  );
                })}
              </div>
              <p className="text-[9px] font-bold mt-0.5"><DecisionLabel it={it} total={slots.length} /></p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
