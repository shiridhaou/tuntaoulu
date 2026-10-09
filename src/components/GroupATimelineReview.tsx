import { useMemo, useState } from "react";
import { ListChecks, X } from "lucide-react";
import type { GroupARow } from "@/lib/groupAConsensus";

type Ded = { code?: string; value?: number; timeSec?: number };

function fmt(sec: number | null) {
  if (sec == null || !Number.isFinite(sec)) return "—";
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}s`;
}

/**
 * Read-only live review of Group A codes per judge, aligned by timestamp.
 * Consumes rows already loaded by useGroupAConsensus — no new channels, no writes.
 */
export function GroupATimelineReview({
  rows, athleteId, className, style,
}: { rows: GroupARow[]; athleteId: string | null; className?: string; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false);

  const { slots, lines } = useMemo(() => {
    const latest = new Map<string, GroupARow>();
    for (const r of rows ?? []) {
      if (!r?.judge_slot) continue;
      if (athleteId && r.athlete_id && r.athlete_id !== athleteId) continue;
      latest.set(r.judge_slot, r);
    }
    const slots = Array.from(latest.keys()).sort();
    type Line = { code: string; value: number; bySlot: Record<string, (number | null)[]> };
    const map = new Map<string, Line>();
    for (const [slot, r] of latest) {
      const deds = (Array.isArray(r.payload?.deductions) ? r.payload!.deductions : []) as Ded[];
      for (const d of deds) {
        if (!d?.code) continue;
        const l = map.get(d.code) ?? { code: d.code, value: Number(d.value ?? 0), bySlot: {} };
        (l.bySlot[slot] ??= []).push(typeof d.timeSec === "number" ? d.timeSec : null);
        map.set(d.code, l);
      }
    }
    const lines = Array.from(map.values()).map(l => {
      const judges = Object.keys(l.bySlot).length;
      const first = Math.min(...Object.values(l.bySlot).flat().map(t => t ?? Infinity));
      return { ...l, judges, first: Number.isFinite(first) ? first : null };
    }).sort((a, b) => (a.first ?? 1e9) - (b.first ?? 1e9));
    return { slots, lines };
  }, [rows, athleteId]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} style={style}>
        <ListChecks className="h-3.5 w-3.5" /> مراجعة A / A Review
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-4xl max-h-[90vh] overflow-auto rounded-2xl border border-white/15 bg-neutral-950 p-4 text-white" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-black text-lg">مراجعة رموز المجموعة A حسب التوقيت / Group A Live Review</h2>
              <button onClick={() => setOpen(false)} className="h-8 w-8 rounded-md bg-white/10 flex items-center justify-center"><X className="h-4 w-4" /></button>
            </div>
            {lines.length === 0 ? (
              <p className="text-white/50 text-sm text-center py-8" dir="rtl">لا توجد رموز مرسلة بعد لهذا اللاعب</p>
            ) : (
              <table className="w-full text-sm" dir="ltr">
                <thead className="text-white/50 text-xs">
                  <tr><th className="text-left p-2">Code</th><th className="p-2">Value</th>
                    {slots.map(s => <th key={s} className="p-2">{s}</th>)}
                    <th className="p-2">Result</th></tr>
                </thead>
                <tbody>
                  {lines.map(l => {
                    const ok = l.judges >= 2 || slots.length < 2;
                    return (
                      <tr key={l.code} className="border-t border-white/10">
                        <td className="p-2 font-black">{l.code}</td>
                        <td className="p-2 text-center text-red-300 tabular-nums">−{l.value.toFixed(2)}</td>
                        {slots.map(s => (
                          <td key={s} className="p-2 text-center tabular-nums">
                            {l.bySlot[s] ? <span className="text-emerald-300">{l.bySlot[s].map(fmt).join(", ")}</span> : <span className="text-white/25">NO</span>}
                          </td>
                        ))}
                        <td className={`p-2 text-center font-black ${ok ? "text-emerald-300" : "text-white/40 line-through"}`}>
                          {ok ? `ACCEPTED ${l.judges}/${slots.length}` : "REJECTED (minority)"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </>
  );
}
