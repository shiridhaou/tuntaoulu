import { Cpu } from "lucide-react";
import type { JudgeStatusRow } from "@/types/matchTypes";

export interface JudgeTeamSize {
  numA: number;
  numB: number;
  numC: number;
}

interface JudgesStatusGridProps {
  statuses?: JudgeStatusRow[] | null;
  liveAthleteName?: string | null;
  team?: Partial<JudgeTeamSize> | null;
}

export function JudgesStatusGrid({
  statuses,
  liveAthleteName,
  team: teamProp,
}: JudgesStatusGridProps) {
  // Defensive: tolerate missing/partial props instead of throwing.
  const rows = Array.isArray(statuses) ? statuses : [];
  const team = {
    numA: teamProp?.numA ?? 0,
    numB: teamProp?.numB ?? 0,
    numC: teamProp?.numC ?? 0,
  };
  // Mapping helpers to render panel groups
  const getGroup = (prefix: string) =>
    rows.filter((s) => typeof s?.judge_slot === "string" && s.judge_slot.startsWith(prefix));

  return (
    <div className="num-west rounded-xl p-3 border border-white/10 bg-black/60 backdrop-blur-sm shadow-inner">
      <div className="flex items-center justify-between mb-2 pb-1 border-b border-white/10">
        <div className="flex items-center gap-1.5 text-xs font-bold text-white/80">
          <Cpu className="h-3.5 w-3.5 text-fed-blue" />
          <span>حالة اتصال طاقم التحكيم</span>
        </div>
        {liveAthleteName && (
          <span className="text-[10px] text-emerald-400 font-mono truncate max-w-[150px]" dir="ltr">
            ● {liveAthleteName}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        {/* Group A */}
        <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
          <p className="text-[10px] text-white/40 mb-1 font-bold">المجموعة A ({team.numA})</p>
          <div className="flex flex-wrap justify-center gap-1">
            {getGroup("A").map((s) => (
              <span
                key={s.judge_slot}
                title={`${s.judge_name || s.judge_slot}: ${s.state}`}
                className={`h-2.5 w-2.5 rounded-full transition-all ${
                  s.state === "sent"
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                    : s.state === "waiting"
                    ? "bg-amber-400 animate-pulse"
                    : "bg-white/20"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Group B */}
        <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
          <p className="text-[10px] text-white/40 mb-1 font-bold">المجموعة B ({team.numB})</p>
          <div className="flex flex-wrap justify-center gap-1">
            {getGroup("B").map((s) => (
              <span
                key={s.judge_slot}
                title={`${s.judge_name || s.judge_slot}: ${s.state}`}
                className={`h-2.5 w-2.5 rounded-full transition-all ${
                  s.state === "sent"
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                    : s.state === "waiting"
                    ? "bg-amber-400 animate-pulse"
                    : "bg-white/20"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Group C */}
        <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5">
          <p className="text-[10px] text-white/40 mb-1 font-bold">المجموعة C ({team.numC})</p>
          <div className="flex flex-wrap justify-center gap-1">
            {getGroup("C").map((s) => (
              <span
                key={s.judge_slot}
                title={`${s.judge_name || s.judge_slot}: ${s.state}`}
                className={`h-2.5 w-2.5 rounded-full transition-all ${
                  s.state === "sent"
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                    : s.state === "waiting"
                    ? "bg-amber-400 animate-pulse"
                    : "bg-white/20"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
