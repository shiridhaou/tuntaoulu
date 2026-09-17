import { Filter, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useGroupAConsensus } from "@/hooks/useGroupAConsensus";

/**
 * Consensus Filter (IWUF rule):
 * A Group A code is OFFICIALLY recorded and deducted only when it appears in
 * the submitted lists of ≥2 Group A judges. Single-judge codes are shown
 * greyed-out / struck-through and are excluded from the Group A total.
 */
export function ConsensusCodesPanel({
  sessionCode,
  athleteId,
  maxA = 5,
}: {
  sessionCode: string | null;
  athleteId: string | null;
  maxA?: number;
}) {
  const { confirmed, flagged, deduction, threshold } = useGroupAConsensus(sessionCode, athleteId, maxA);

  if (!sessionCode) return null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-md px-3 py-2">
      <div className="flex items-center gap-2 mb-1.5">
        <Filter className="h-3.5 w-3.5 text-emerald-300" />
        <p className="text-[10px] font-black tracking-[0.25em] text-white/70" dir="ltr">CONSENSUS · GROUP A</p>
        <span className="ml-auto text-[9px] text-white/40 font-body" dir="ltr">
          ≥ {threshold} judge{threshold > 1 ? "s" : ""} · −{deduction.toFixed(3)}
        </span>
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
                  title={`Confirmed by ${c.slots.join(", ")} — ${c.label}`}
                >
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  {c.code} <span className="opacity-60">×{c.count}</span>
                  {c.value > 0 && <span className="opacity-80">−{c.value.toFixed(3)}</span>}
                </span>
              ))}
            </div>
          )}
          {flagged.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-white/5">
              <span className="text-[9px] text-amber-300/80 font-bold uppercase tracking-wider mr-1" dir="ltr">
                Disregarded · single judge
              </span>
              {flagged.map((f, i) => (
                <span
                  key={`${f.code}-${i}`}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold tabular-nums border line-through opacity-50"
                  style={{
                    background: "rgba(148,163,184,0.08)",
                    borderColor: "rgba(148,163,184,0.35)",
                    color: "#cbd5e1",
                  }}
                  dir="ltr"
                  title={`Only from ${f.slot} — disregarded`}
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
