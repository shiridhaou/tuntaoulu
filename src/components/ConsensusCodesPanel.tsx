import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Filter, AlertTriangle, CheckCircle2 } from "lucide-react";

/**
 * Consensus Filter (IWUF rule):
 * A Group A code is OFFICIALLY recorded only if submitted by ≥2 judges.
 * Single-judge codes are flagged for review/deletion.
 *
 * Subscribes to `judge_scores` for the current session+athlete and aggregates
 * `payload.codes: string[]` from each Judge A slot in real time.
 */
export function ConsensusCodesPanel({
  sessionCode,
  athleteId,
}: {
  sessionCode: string | null;
  athleteId: string | null;
}) {
  type Row = { judge_slot: string; payload: { codes?: string[] } | null; athlete_id: string | null; judge_role: string };
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!sessionCode) { setRows([]); return; }
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from("judge_scores")
        .select("judge_slot, judge_role, athlete_id, payload")
        .eq("session_code", sessionCode)
        .eq("judge_role", "A");
      if (!cancelled) setRows((data ?? []) as unknown as Row[]);
    };
    void load();

    const ch = supabase
      .channel(`consensus-${sessionCode}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "judge_scores", filter: `session_code=eq.${sessionCode}` },
        () => { void load(); },
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [sessionCode]);

  const { confirmed, flagged } = useMemo(() => {
    // Only this athlete's A submissions
    const relevant = rows.filter(r => r.judge_role === "A" && (!athleteId || r.athlete_id === athleteId));
    // code → set of slots that submitted it
    const counter = new Map<string, Set<string>>();
    relevant.forEach(r => {
      const codes = Array.isArray(r.payload?.codes) ? r.payload!.codes! : [];
      codes.forEach(code => {
        if (!counter.has(code)) counter.set(code, new Set());
        counter.get(code)!.add(r.judge_slot);
      });
    });
    const confirmed: { code: string; count: number; slots: string[] }[] = [];
    const flagged: { code: string; slot: string }[] = [];
    counter.forEach((slots, code) => {
      const list = Array.from(slots);
      if (list.length >= 2) confirmed.push({ code, count: list.length, slots: list });
      else flagged.push({ code, slot: list[0] });
    });
    confirmed.sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
    flagged.sort((a, b) => a.code.localeCompare(b.code));
    return { confirmed, flagged };
  }, [rows, athleteId]);

  if (!sessionCode) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-md px-3 py-2">
      <div className="flex items-center gap-2 mb-1.5">
        <Filter className="h-3.5 w-3.5 text-emerald-300" />
        <p className="text-[10px] font-black tracking-[0.25em] text-white/70" dir="ltr">CONSENSUS · GROUP A</p>
        <span className="ml-auto text-[9px] text-white/40 font-body" dir="ltr">≥ 2 judges</span>
      </div>

      {confirmed.length === 0 && flagged.length === 0 ? (
        <p className="text-[10px] text-white/30 italic" dir="rtl">في انتظار أكواد الحكام…</p>
      ) : (
        <div className="space-y-1.5">
          {confirmed.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {confirmed.map(c => (
                <span
                  key={c.code}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black tabular-nums border"
                  style={{
                    background: "rgba(16,185,129,0.15)",
                    borderColor: "rgba(16,185,129,0.55)",
                    color: "#6ee7b7",
                    boxShadow: "0 0 12px rgba(16,185,129,0.25)",
                  }}
                  dir="ltr"
                  title={`Confirmed by ${c.slots.join(", ")}`}
                >
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  {c.code} <span className="opacity-60">×{c.count}</span>
                </span>
              ))}
            </div>
          )}
          {flagged.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-white/5">
              <span className="text-[9px] text-amber-300/80 font-bold uppercase tracking-wider mr-1" dir="ltr">
                Flagged · single judge
              </span>
              {flagged.map((f, i) => (
                <span
                  key={`${f.code}-${i}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold tabular-nums border line-through opacity-70"
                  style={{
                    background: "rgba(251,191,36,0.08)",
                    borderColor: "rgba(251,191,36,0.4)",
                    color: "#fcd34d",
                  }}
                  dir="ltr"
                  title={`Only from ${f.slot} — discarded`}
                >
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {f.code} ({f.slot})
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
