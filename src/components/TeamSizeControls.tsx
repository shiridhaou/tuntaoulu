import { Users, Plus, Minus } from "lucide-react";
import { Button } from "./ui/button";
import type { JudgeTeamSize } from "./JudgesStatusGrid";

interface TeamSizeControlsProps {
  team?: Partial<JudgeTeamSize> | null;
  onChange?: (group: keyof JudgeTeamSize, delta: number) => void;
}

const DEFAULT_TEAM: JudgeTeamSize = { numA: 4, numB: 4, numC: 2 };

export function TeamSizeControls({ team: teamProp, onChange }: TeamSizeControlsProps) {
  // Defensive: never throw if the parent passes a partial / missing team object.
  const team: JudgeTeamSize = {
    numA: Number(teamProp?.numA ?? DEFAULT_TEAM.numA) || DEFAULT_TEAM.numA,
    numB: Number(teamProp?.numB ?? DEFAULT_TEAM.numB) || DEFAULT_TEAM.numB,
    numC: Number(teamProp?.numC ?? DEFAULT_TEAM.numC) || DEFAULT_TEAM.numC,
  };
  const change = (group: keyof JudgeTeamSize, delta: number) => {
    if (typeof onChange === "function") onChange(group, delta);
  };
  return (
    <div className="num-west rounded-xl p-3 border border-white/10 bg-black/40 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-xs font-bold text-white/80 mb-2 pb-1 border-b border-white/10">
        <Users className="h-3.5 w-3.5 text-cyber-orange" />
        <span>تعديل عدد الحكام لكل مجموعة</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* Group A */}
        <div className="flex items-center justify-between p-1.5 rounded-lg bg-white/[0.02] border border-white/5">
          <span className="text-[10px] text-white/60 font-bold">A</span>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => change("numA", -1)}
              disabled={team.numA <= 1}
              className="h-5 w-5 text-white/70 hover:bg-white/10"
            >
              <Minus className="h-2.5 w-2.5" />
            </Button>
            <span className="text-xs font-mono font-bold text-white min-w-[12px] text-center">
              {team.numA}
            </span>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => change("numA", 1)}
              disabled={team.numA >= 5}
              className="h-5 w-5 text-white/70 hover:bg-white/10"
            >
              <Plus className="h-2.5 w-2.5" />
            </Button>
          </div>
        </div>

        {/* Group B */}
        <div className="flex items-center justify-between p-1.5 rounded-lg bg-white/[0.02] border border-white/5">
          <span className="text-[10px] text-white/60 font-bold">B</span>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => change("numB", -1)}
              disabled={team.numB <= 1}
              className="h-5 w-5 text-white/70 hover:bg-white/10"
            >
              <Minus className="h-2.5 w-2.5" />
            </Button>
            <span className="text-xs font-mono font-bold text-white min-w-[12px] text-center">
              {team.numB}
            </span>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => change("numB", 1)}
              disabled={team.numB >= 5}
              className="h-5 w-5 text-white/70 hover:bg-white/10"
            >
              <Plus className="h-2.5 w-2.5" />
            </Button>
          </div>
        </div>

        {/* Group C */}
        <div className="flex items-center justify-between p-1.5 rounded-lg bg-white/[0.02] border border-white/5">
          <span className="text-[10px] text-white/60 font-bold">C</span>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => change("numC", -1)}
              disabled={team.numC <= 1}
              className="h-5 w-5 text-white/70 hover:bg-white/10"
            >
              <Minus className="h-2.5 w-2.5" />
            </Button>
            <span className="text-xs font-mono font-bold text-white min-w-[12px] text-center">
              {team.numC}
            </span>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => change("numC", 1)}
              disabled={team.numC >= 5}
              className="h-5 w-5 text-white/70 hover:bg-white/10"
            >
              <Plus className="h-2.5 w-2.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
