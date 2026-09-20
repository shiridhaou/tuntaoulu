import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ListChecks, Send, CheckCircle2, Trash2, Plus, ShieldCheck, ShieldAlert } from "lucide-react";
import { validateDifficultySheet } from "@/lib/groupCValidation";
import { validateGroupC, FAMILY_LABEL } from "@/lib/iwufDifficultyRules";
import { MAX_C_MOVEMENT, MAX_C_CONNECTION } from "@/lib/difficultyCodes";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { useDifficultySheet, type DifficultySheetSourceAthlete } from "@/hooks/useDifficultySheet";
import { toWesternDigits } from "@/lib/numFormat";
import { lookupCode, isConnectionCode, isKnownCode, KNOWN_CODE_OPTIONS } from "@/lib/difficultyCodes";
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
  /** Discipline used to validate the sequence (Changquan / Nanquan / Taiji). */
  style?: string | null;
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
  const [override, setOverride] = useState(false);
  const [allowAutoPush, setAllowAutoPush] = useState(true);
  const { sheet, total, pushed, saving, addRow, removeRow, updateRow, saveSheet } =
    useDifficultySheet({
      sessionCode,
      targetAthlete,
      isLive,
      onSaved: () => { if (typeof onSaved === "function") onSaved(); },
      allowAutoPush,
    });

  // ── IWUF compliance check (discipline-aware) ──────────────────────────────
  const validation = useMemo(
    () => validateDifficultySheet(sheet, targetAthlete?.style ?? null),
    [sheet, targetAthlete?.style],
  );
  const errors = validation.issues.filter((x) => x.severity === "error");

  // ── Advisory IWUF connection engine (never blocks the push) ───────────────
  const ruleAdvice = useMemo(() => {
    const movements = sheet.filter((d) => !isConnectionCode(d.code)).map((d) => d.code);
    const connections = sheet.filter((d) => isConnectionCode(d.code)).map((d) => d.code);
    return validateGroupC(targetAthlete?.style ?? null, movements, connections);
  }, [sheet, targetAthlete?.style]);
  const compliant = validation.valid;
  const canPush = compliant || override;

  useEffect(() => { setOverride(false); }, [targetAthlete?.id]);
  useEffect(() => { setAllowAutoPush(canPush); }, [canPush]);


  // Local UI-only state for the "add movement" row — raw text input parsing
  // (comma decimal support) stays here; the hook deals in numbers only.
  const [newCode, setNewCode] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newLabel, setNewLabel] = useState("");

  function handleAddRow() {
    const v = parseFloat(newValue.replace(",", "."));
    // Blank value → auto-fill the IWUF default for this code.
    const prevCode = [...sheet].reverse().find((d) => !isConnectionCode(d.code))?.code ?? null;
    const meta = lookupCode(newCode, { prevCode });
    addRow(newCode, newLabel || meta.label, isFinite(v) ? v : meta.value);
    setNewCode(""); setNewValue(""); setNewLabel("");
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
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
            validation.movementTotal > MAX_C_MOVEMENT
              ? "border-fed-red/60 bg-fed-red/10" : "border-white/10 bg-white/5"
          }`}>
            <span className="text-[9px] text-white/50" dir="ltr">D {MAX_C_MOVEMENT.toFixed(2)}</span>
            <span className="text-sm font-heading font-black text-white tabular-nums">{validation.movementTotal.toFixed(2)}</span>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
            validation.connectionTotal > MAX_C_CONNECTION
              ? "border-fed-red/60 bg-fed-red/10" : "border-white/10 bg-white/5"
          }`}>
            <span className="text-[9px] text-white/50" dir="ltr">C {MAX_C_CONNECTION.toFixed(2)}</span>
            <span className="text-sm font-heading font-black text-white tabular-nums">{validation.connectionTotal.toFixed(2)}</span>
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
          <Button type="button" onClick={() => void saveSheet(true)} size="sm"
            disabled={saving || !sessionCode || sheet.length === 0 || !canPush}
            className="h-8 bg-cyber-orange text-black hover:brightness-110 font-bold text-xs disabled:opacity-40">
            <Send className="h-3 w-3 ml-1" /> دفع لحكام C
          </Button>
        </div>
      </div>

      {/* ===== FORM STATUS — IWUF compliance ===== */}
      {sheet.length > 0 && (
        <div className={`mb-3 rounded-xl border px-3 py-2 ${
          compliant
            ? "border-emerald-500/40 bg-emerald-500/10"
            : "border-fed-red/50 bg-fed-red/10"
        }`}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              {compliant
                ? <ShieldCheck className="h-4 w-4 text-emerald-400" />
                : <ShieldAlert className="h-4 w-4 text-fed-red" />}
              <span className={`text-[11px] font-bold ${compliant ? "text-emerald-300" : "text-fed-red"}`} dir="ltr">
                {compliant ? "Form Status: VALIDATED (IWUF Compliant)" : "Form Status: REJECTED / NON-COMPLIANT"}
              </span>
              <span className="text-[10px] text-white/50" dir="ltr">{validation.style}</span>
            </div>
            {!compliant && (
              <Button type="button" size="sm" variant="outline" onClick={() => setOverride((v) => !v)}
                className="h-7 text-[10px] border-white/20 text-white/80 hover:bg-white/10">
                {override ? "إلغاء التجاوز اليدوي" : "تجاوز يدوي والسماح بالإرسال"}
              </Button>
            )}
          </div>
          {!compliant && (
            <ul className="mt-1.5 space-y-0.5">
              {errors.map((iss, i) => (
                <li key={i} className="text-[10px] text-fed-red/90">
                  {iss.position ? `#${iss.position} — ` : ""}{iss.message}
                </li>
              ))}
            </ul>
          )}
          {!compliant && override && (
            <p className="text-[10px] text-amber-300 mt-1">⚠️ تم تفعيل التجاوز اليدوي — الإرسال متاح على مسؤولية المساعد التقني.</p>
          )}
        </div>
      )}


      {/* Advisory IWUF connection warnings — never block the push */}
      {ruleAdvice.issues.length > 0 && (
        <div className="mb-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-300" />
            <span className="text-[11px] font-bold text-amber-200" dir="ltr">
              IWUF Advisory · {FAMILY_LABEL[ruleAdvice.family].en}
            </span>
          </div>
          <ul className="mt-1.5 space-y-0.5">
            {ruleAdvice.issues.map((iss, i) => (
              <li key={`${iss.code}-${i}`} className="text-[10px] text-amber-200/90">
                <span className="font-mono num-west" dir="ltr">{iss.code}</span> — {iss.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Valid IWUF codes offered as inline suggestions in every code input */}
      <datalist id="iwuf-code-options">
        {KNOWN_CODE_OPTIONS.map((o) => (
          <option key={o.code} value={o.code}>{`${o.label} — ${o.value.toFixed(2)}`}</option>
        ))}
      </datalist>

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
                <span className="col-span-1 text-[10px] text-white/40 font-mono text-center num-west">{i + 1}</span>
                <Input
                  value={toWesternDigits(d.code)}
                  list="iwuf-code-options"
                  onChange={(e) => {
                    const code = toWesternDigits(e.target.value).toUpperCase();
                    if (isKnownCode(code)) {
                      const prevCode = [...sheet].slice(0, i).reverse().find((x) => !isConnectionCode(x.code))?.code ?? null;
                      const meta = lookupCode(code, { style: targetAthlete?.style ?? null, prevCode });
                      updateRow(i, { code, label: meta.label, value: meta.value });
                    } else {
                      updateRow(i, { code });
                    }
                  }}
                  className={`col-span-2 h-7 text-xs font-mono font-bold bg-black num-west ${
                    isKnownCode(d.code)
                      ? "text-cyber-orange border-white/10"
                      : "text-fed-red border-fed-red/60"
                  }`}
                  dir="ltr"
                  lang="en"
                  inputMode="text"
                />
                <div className="col-span-7 flex items-center gap-2">
                  <Input
                    value={d.label}
                    onChange={(e) => updateRow(i, { label: e.target.value })}
                    placeholder="اسم الحركة / Label"
                    className="flex-1 h-7 text-xs bg-black border-white/10 text-white"
                  />
                  {!isKnownCode(d.code) && (
                    <span className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold bg-fed-red/20 text-fed-red border border-fed-red/40" dir="ltr">
                      Invalid Code
                    </span>
                  )}
                </div>
                <Input
                  type="number" step="0.05" min="0" max="1"
                  value={toWesternDigits(d.value)}
                  onChange={(e) => updateRow(i, { value: parseFloat(toWesternDigits(e.target.value)) || 0 })}
                  className="col-span-1 h-7 text-xs text-center font-mono font-bold text-emerald-400 bg-black border-white/10 num-west"
                  dir="ltr"
                  lang="en"
                  inputMode="decimal"
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
          onChange={(e) => setNewCode(toWesternDigits(e.target.value).toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && handleAddRow()}
          placeholder="Code (e.g. 323A)"
          list="iwuf-code-options"
          className="col-span-3 h-8 text-xs font-mono bg-black border-white/15 num-west"
          dir="ltr"
          lang="en"
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
          onChange={(e) => setNewValue(toWesternDigits(e.target.value))}
          onKeyDown={(e) => e.key === "Enter" && handleAddRow()}
          placeholder="تلقائي"
          className="col-span-2 h-8 text-xs text-center font-mono bg-black border-white/15 num-west"
          dir="ltr"
          lang="en"
          inputMode="decimal"
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
