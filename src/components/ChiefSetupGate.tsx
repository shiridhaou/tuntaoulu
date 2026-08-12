import { useState } from "react";
import { useCompetition, DEFAULT_TEAM, type TeamConfig } from "@/store/competition-store";
import { FederationLogo } from "./FederationLogo";
import { Plus, Minus, ArrowRight, ShieldCheck } from "lucide-react";
import { COMPULSORY_CAPS, OPTIONAL_CAPS, type MatchMode } from "@/lib/matchMode";
import { toast } from "sonner";

const ORANGE = "#FF7A1A";
const GOLD = "#F4C542";

/** Official federation table presets. */
const MODE_PRESETS: Record<MatchMode, TeamConfig> = {
  // Compulsory — 8 judges total (A:4, B:4, C disabled)
  compulsory: { numA: 4, numB: 4, numC: 0 },
  // Optional — 11 judges total (A:3, B:5, C:3)
  optional: { numA: 3, numB: 5, numC: 3 },
};

export function ChiefSetupGate({ onComplete }: { onComplete: () => void }) {
  const { team, setTeamConfig, generateSessionCode, sessionCode, setSetupComplete, setStyleMode } = useCompetition();
  const [mode, setMode] = useState<MatchMode>("optional");
  const [draft, setDraft] = useState<TeamConfig>(team ?? DEFAULT_TEAM ?? MODE_PRESETS.optional);
  const [starting, setStarting] = useState(false);

  const caps = mode === "compulsory" ? COMPULSORY_CAPS : OPTIONAL_CAPS;
  const limits: Record<keyof TeamConfig, readonly [number, number]> = {
    numA: [1, 8],
    numB: [1, 8],
    numC: mode === "compulsory" ? [0, 0] : [1, 8],
  };

  const applyMode = (m: MatchMode) => {
    setMode(m);
    setDraft(MODE_PRESETS[m]);
    setStyleMode?.(m === "compulsory" ? "mandatory" : "optional");
  };

  const update = (k: keyof TeamConfig, d: number) => {
    const [min, max] = limits[k];
    setDraft(prev => ({ ...prev, [k]: Math.max(min, Math.min(max, prev[k] + d)) }));
  };

  const total = draft.numA + draft.numB + draft.numC;

  const handleStart = async () => {
    if (starting) return;
    setStarting(true);
    try {
      if (!sessionCode) await generateSessionCode();
      setTeamConfig(draft);
      setSetupComplete(true);
      onComplete();
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر بدء الجلسة";
      toast.error("فشل إنشاء الجلسة", { description: message });
    } finally {
      setStarting(false);
    }
  };

  const Row = ({ label, en, k, disabled }: { label: string; en: string; k: keyof TeamConfig; disabled?: boolean }) => (
    <div className={`flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3 ${disabled ? "opacity-40" : ""}`}>
      <div className="min-w-0 pr-2">
        <p className="text-base font-heading font-black text-white">{label}</p>
        <p className="text-[11px] text-white/50 font-body" dir="ltr">{en}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button disabled={disabled} onClick={() => update(k, -1)}
          className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:cursor-not-allowed flex items-center justify-center">
          <Minus className="h-4 w-4" />
        </button>
        <span className="h-10 w-14 flex items-center justify-center text-2xl font-heading font-black tabular-nums" style={{ color: GOLD }} dir="ltr">
          {draft[k]}
        </span>
        <button disabled={disabled} onClick={() => update(k, +1)}
          className="h-10 w-10 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 disabled:cursor-not-allowed flex items-center justify-center">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 text-white" style={{ background: "#050505" }}>
      <div className="w-full max-w-lg">
        <div className="flex justify-center mb-6">
          <FederationLogo size="md" />
        </div>
        <div className="rounded-3xl border bg-[#0a0a0a] p-6 space-y-5"
          style={{ borderColor: `${ORANGE}55`, boxShadow: `0 0 60px ${ORANGE}22` }}>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl border flex items-center justify-center"
              style={{ background: `${ORANGE}1A`, borderColor: `${ORANGE}66` }}>
              <ShieldCheck className="h-5 w-5" style={{ color: ORANGE }} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] font-body" style={{ color: ORANGE }}>Setup</p>
              <h1 className="text-xl font-heading font-black text-white">إعداد الفريق التحكيمي</h1>
            </div>
          </div>

          {/* Official mode presets */}
          <div className="grid grid-cols-2 gap-2">
            {(["compulsory", "optional"] as MatchMode[]).map(m => {
              const active = mode === m;
              const p = MODE_PRESETS[m];
              return (
                <button key={m} onClick={() => applyMode(m)}
                  className="rounded-2xl border p-3 text-right transition-all hover:brightness-110"
                  style={{
                    background: active ? `${GOLD}1A` : "rgba(255,255,255,0.02)",
                    borderColor: active ? `${GOLD}99` : "rgba(255,255,255,0.08)",
                    boxShadow: active ? `0 0 22px ${GOLD}44` : "none",
                  }}>
                  <p className="text-[10px] uppercase tracking-[0.25em] font-body" style={{ color: active ? GOLD : "rgba(255,255,255,0.45)" }} dir="ltr">
                    {m === "compulsory" ? "Compulsory · 8 judges" : "Optional · 11 judges"}
                  </p>
                  <p className="text-sm font-heading font-black text-white mt-0.5">
                    {m === "compulsory" ? "الأساليب الإلزامية" : "الأساليب الاختيارية"}
                  </p>
                  <p className="text-[11px] text-white/45 font-body" dir="ltr">
                    A:{p.numA} · B:{p.numB} · C:{p.numC || "—"}
                  </p>
                </button>
              );
            })}
          </div>

          <p className="text-sm text-white/60 font-body leading-relaxed">
            الإعدادات الرسمية محمّلة تلقائياً حسب الأسلوب — يمكنك تعديل عدد القضاة في كل مجموعة (حتى 8 لكل مجموعة).
          </p>

          <div className="space-y-2">
            <Row label="مجموعة A — الجودة التقنية" en={`Group A · Technical Quality (Ceiling: ${caps.maxA.toFixed(2)})`} k="numA" />
            <Row label="مجموعة B — الأداء العام" en={`Group B · Overall Performance (Ceiling: ${caps.maxB.toFixed(2)})`} k="numB" />
            <Row
              label="مجموعة C — الصعوبة"
              en={mode === "compulsory"
                ? "Group C · Degree of Difficulty (Disabled in Compulsory)"
                : "Group C · Degree of Difficulty (Ceiling: 2.00 — 1.40 Mvt + 0.60 Conn)"}
              k="numC"
              disabled={mode === "compulsory"}
            />
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-2.5">
            <p className="text-xs font-body text-white/60">مجموع القضاة · Total judges</p>
            <p className="text-xl font-heading font-black tabular-nums" style={{ color: GOLD }} dir="ltr">{total}</p>
          </div>

          <button onClick={() => void handleStart()} disabled={starting}
            className="w-full h-14 rounded-2xl font-heading font-black text-base tracking-[0.25em] flex items-center justify-center gap-2 transition-all hover:brightness-110"
            style={{ background: `linear-gradient(135deg, ${GOLD}, ${ORANGE})`, color: "#000",
                     boxShadow: `0 0 30px ${ORANGE}55` }}>
            {starting ? "جارٍ إنشاء الجلسة…" : "بدء الجلسة · START SESSION"}
            <ArrowRight className="h-5 w-5 rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
}
