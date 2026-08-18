import { useState } from "react";
import { motion } from "framer-motion";
import { ListChecks, Send, CheckCircle2, Trash2, Plus } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useDifficultySheet, type DifficultySheetSourceAthlete } from "@/hooks/useDifficultySheet";
import type { JudgeStatusRow } from "@/types/matchTypes";

// ============================================================================
// Types
// ============================================================================

/**
 * The subset of athlete fields this component needs: the sheet-loading
 * fields required by useDifficultySheet, plus the two fields shown in the
 * header (name / bib). Any athlete object with at least these fields can be
 * passed in — no dependency on the dashboard's full `Athlete` type.
 */
export interface DifficultyManagerAthlete extends DifficultySheetSourceAthlete {
  full_name: string;
  bib_number: string | null;
}

interface DifficultyManagerProps {
  sessionCode?: string | null;
  targetAthlete?: DifficultyManagerAthlete | null;
  isLive?: boolean;
  judgeStatuses?: JudgeStatusRow[] | null;
  onSaved?: () => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * DIFFICULTY MANAGER — black box that lets the TA review/edit the Group C
 * movement sheet for the live (or up-next) athlete and push it to all C judges.
 */
export function DifficultyManager({
  sessionCode = null,
  targetAthlete = null,
  isLive = false,
  judgeStatuses,
  onSaved,
}: DifficultyManagerProps) {
  // Defensive: never throw when optional props are missing.
  const statuses = Array.isArray(judgeStatuses) ? judgeStatuses : [];
  const { sheet, total, pushed, saving, addRow, removeRow, updateRow, saveSheet } =
    useDifficultySheet({
      sessionCode,
      targetAthlete,
      isLive,
      onSaved: () => { if (typeof onSaved === "function") onSaved(); },
    });

  // Local UI-only state for the "add movement" row — raw text input parsing
  // (comma decimal support) stays here; the hook deals in numbers only.
  const [newCode, setNewCode] = useState("");
  const [newValue, setNewValue] = useState("0.20");
  const [newLabel, setNewLabel] = useState("");

  function handleAddRow() {
    const v = parseFloat(newValue.replace(",", "."));
    addRow(newCode, newLabel, isFinite(v) ? v : 0.2);
    setNewCode(""); setNewValue("0.20"); setNewLabel("");
  }

  const cJudgesSent = statuses.filter((s) => s.judge_slot.startsWith("C") && s.state === "sent").length;
  const cJudgesActive = statuses.filter((s) => s.judge_slot.startsWith("C")).length;

  if (!targetAthlete) {
    return (
      <div className="rounded-2xl p-4 border-2 border-white/10 bg-black text-center text-muted-foreground text-xs">
        <ListChecks className="h-5 w-5 mx-auto mb-2 opacity-40" />
        لا يوجد لاعب نشط أو قادم — اختر لاعباً من القائمة لإدارة استمارة الصعوبات
      </div>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="num-west rounded-2xl p-3 border-2 border-cyber-orange/40 bg-black shadow-[0_0_24px_rgba(251,146,60,0.15)]"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-cyber-orange/15 border border-cyber-orange/40 flex items-center justify-center">
            <ListChecks className="h-4 w-4 text-cyber-orange" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest text-cyber-orange font-bold leading-none" dir="ltr">
              Group C — Difficulty Sheet
            </p>
            <p className="text-xs text-white/80 font-bold truncate">
              {targetAthlete.full_name}
              {targetAthlete.bib_number && <span className="text-gold font-mono mx-1">#{targetAthlete.bib_number}</span>}
              <span className={`mr-2 px-2 py-0.5 rounded text-[9px] font-bold ${isLive ? "bg-emerald-500/20 text-emerald-300" : "bg-fed-blue/20 text-fed-blue"}`}>
                {isLive ? "● LIVE" : "UP NEXT"}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 bg-white/5">
            <span className="text-[9px] text-white/50" dir="ltr">Movements</span>
            <span className="text-sm font-heading font-black text-white">{sheet.length}</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-cyber-orange/40 bg-cyber-orange/10">
            <span className="text-[9px] text-cyber-orange/80" dir="ltr">Total</span>
            <span className="text-sm font-heading font-black text-cyber-orange tabular-nums">{total.toFixed(2)}</span>
          </div>
          {/* RC-8: receipt is shown for pre-match pushes too, not just LIVE. */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
            pushed
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/50 bg-amber-500/10 text-amber-300"
          }`}>
            <span className="text-[9px] font-bold">
              {pushed ? `✓ تم الإرسال — ${cJudgesSent}/${cJudgesActive || "C"} قيّموا` : "بانتظار الإرسال"}
            </span>
          </div>

          <Button onClick={() => saveSheet(false)} size="sm" variant="outline" disabled={saving}
            className="h-8 border-white/20 text-white/80 hover:bg-white/10 text-xs">
            <CheckCircle2 className="h-3 w-3 ml-1" /> حفظ
          </Button>
          <Button type="button" onClick={() => void saveSheet(true)} size="sm" disabled={saving || !sessionCode || sheet.length === 0}
            className="h-8 bg-cyber-orange text-black hover:brightness-110 font-bold text-xs disabled:opacity-40">
            <Send className="h-3 w-3 ml-1" /> دفع لحكام C
          </Button>
        </div>
      </div>

      {/* Sheet rows */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
        {sheet.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            لا توجد حركات بعد — أضف الحركات أدناه أو ارجع إلى الاستيراد لإضافة أعمدة C1_code, C1_value …
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {sheet.map((d, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 px-2 py-1.5 items-center hover:bg-white/[0.03]">
                <span className="col-span-1 text-[10px] text-white/40 font-mono text-center">{i + 1}</span>
                <Input
                  value={d.code}
                  onChange={(e) => updateRow(i, { code: e.target.value.toUpperCase() })}
                  className="col-span-2 h-7 text-xs font-mono font-bold text-cyber-orange bg-black border-white/10 num-west"
                  dir="ltr"
                />
                <Input
                  value={d.label}
                  onChange={(e) => updateRow(i, { label: e.target.value })}
                  placeholder="اسم الحركة / Label"
                  className="col-span-7 h-7 text-xs bg-black border-white/10 text-white"
                />
                <Input
                  type="number" step="0.05" min="0" max="1"
                  value={d.value}
                  onChange={(e) => updateRow(i, { value: parseFloat(e.target.value) || 0 })}
                  className="col-span-1 h-7 text-xs text-center font-mono font-bold text-emerald-400 bg-black border-white/10 num-west"
                  dir="ltr"
                />
                <Button onClick={() => removeRow(i)} size="icon" variant="ghost"
                  className="col-span-1 h-7 w-7 text-fed-red hover:bg-fed-red/10 mx-auto">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add row */}
      <div className="grid grid-cols-12 gap-2 mt-2 items-center">
        <Input
          value={newCode}
          onChange={(e) => setNewCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleAddRow()}
          placeholder="Code (e.g. 323A)"
          className="col-span-3 h-8 text-xs font-mono bg-black border-white/15"
          dir="ltr"
        />
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddRow()}
          placeholder="اسم الحركة (اختياري)"
          className="col-span-6 h-8 text-xs bg-black border-white/15"
        />
        <Input
          type="number" step="0.05" min="0" max="1"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddRow()}
          className="col-span-2 h-8 text-xs text-center font-mono bg-black border-white/15"
          dir="ltr"
        />
        <Button onClick={handleAddRow} size="sm" className="col-span-1 h-8 bg-emerald-500 hover:bg-emerald-600 text-white">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      <p className="text-[10px] text-white/40 mt-2 text-center">
        💡 يمكن للمساعد التقني التعديل قبل الضغط على "ابدأ" — أو الدفع المباشر إلى حكام C أثناء المباراة باستخدام زر "دفع لحكام C".
      </p>
    </motion.section>
  );
}
