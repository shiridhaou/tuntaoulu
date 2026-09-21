import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildScoreSheetPdf, type ScoreSheetData } from "@/lib/scoreSheetPdf";
import { useCompetition } from "@/store/competition-store";
import {
  X, Download, Share2, CheckCircle, FileText, Tv, Loader2, AlertCircle,
} from "lucide-react";

const GOLD = "#F4C542";
const ORANGE = "#FF7A1A";
const NAVY = "#0A192F";
const GREEN = "#10B981";
const RED = "#EF4444";

export interface FinalScoreSheetModalProps {
  onClose: () => void;
  matchMode: "compulsory" | "optional";
  taOobCount: number;
  taDeduction: number;
  chiefDeduction: number;
  // Group A
  groupAScore: number;
  groupAMax: number;
  // Group B
  bIndividualScores: { slot: string; score: number | null; role: "high" | "low" | "kept" | "single" }[];
  groupBAverage: number;
  groupBMax: number;
  // Group C
  groupCScore: number;
  groupCMax: number;
  // Final aggregated by Chief; TA timing remains informational.
  finalScore: number;
}

export function FinalScoreSheetModal(props: FinalScoreSheetModalProps) {
  const {
    onClose, matchMode, taOobCount, taDeduction, chiefDeduction,
    groupAScore, groupAMax, bIndividualScores, groupBAverage, groupBMax,
    groupCScore, groupCMax, finalScore,
  } = props;

  const {
    sessionCode, athletes, currentAthleteIndex, competitionStyle, timerElapsed,
  } = useCompetition();
  const athlete = athletes[currentAthleteIndex];

  // ── Fetch enriched athlete row + Group A consensus codes ─────────────────
  const [club, setClub] = useState<string | null>(null);
  const [bib, setBib] = useState<string | null>(null);
  const [aRows, setARows] = useState<{ judge_slot: string; payload: { codes?: string[] } | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (athlete?.id) {
          const { data: a } = await supabase
            .from("athletes")
            .select("club, bib_number")
            .eq("id", athlete.id)
            .maybeSingle();
          if (!cancelled && a) {
            setClub((a as any).club ?? null);
            setBib((a as any).bib_number ?? null);
          }
        }
        if (sessionCode && athlete?.id) {
          const { data: rows } = await supabase
            .from("judge_scores")
            .select("judge_slot, payload, athlete_id, judge_role")
            .eq("session_code", sessionCode)
            .eq("judge_role", "A")
            .eq("athlete_id", athlete.id);
          if (!cancelled) setARows((rows ?? []) as any);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sessionCode, athlete?.id]);

  // Aggregate consensus codes (≥2 judges)
  const { confirmedCodes, flaggedCodes } = useMemo(() => {
    const counter = new Map<string, Set<string>>();
    aRows.forEach(r => {
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
    return { confirmedCodes: confirmed, flaggedCodes: flagged };
  }, [aRows]);

  // Build the PDF data once
  const sheetData: ScoreSheetData = useMemo(() => ({
    athleteName: athlete?.name ?? "—",
    bibNumber: bib,
    club,
    country: athlete?.country ?? null,
    category: athlete?.category ?? null,
    style: competitionStyle ?? null,
    matchMode,
    sessionCode,
    performanceTime: timerElapsed,
    aConfirmedCodes: confirmedCodes,
    aFlaggedCodes: flaggedCodes,
    groupAScore, groupAMax,
    bIndividualScores, groupBAverage, groupBMax,
    cMovements: (athlete?.difficultySheet ?? []).map(m => ({
      code: m.code, label: m.label, connection: m.connection, value: m.value,
    })),
    groupCScore, groupCMax,
    taOobCount, taDeduction, chiefDeduction,
    finalScore,
    committedAt: Date.now(),
  }), [
    athlete, bib, club, competitionStyle, matchMode, sessionCode, timerElapsed,
    confirmedCodes, flaggedCodes, groupAScore, groupAMax, bIndividualScores,
    groupBAverage, groupBMax, groupCScore, groupCMax, taOobCount, taDeduction, chiefDeduction, finalScore,
  ]);

  // ── Actions ──────────────────────────────────────────────
  const downloadPdf = () => {
    const { blob, filename } = buildScoreSheetPdf(sheetData);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const [shareError, setShareError] = useState<string | null>(null);
  const sharePdf = async () => {
    setShareError(null);
    const { blob, filename } = buildScoreSheetPdf(sheetData);
    const file = new File([blob], filename, { type: "application/pdf" });
    const summary =
      `Final Score Sheet — ${sheetData.athleteName}\n` +
      `Score: ${sheetData.finalScore.toFixed(3)} (${sheetData.matchMode.toUpperCase()})\n` +
      `Style: ${sheetData.style ?? "—"}`;

    try {
      const nav = navigator as any;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({
          files: [file],
          title: "Final Score Sheet",
          text: summary,
        });
        return;
      }
      if (nav.share) {
        await nav.share({ title: "Final Score Sheet", text: summary });
        return;
      }
      // Fallback: WhatsApp web with text only
      const wa = `https://wa.me/?text=${encodeURIComponent(summary)}`;
      window.open(wa, "_blank", "noopener");
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setShareError(e?.message || "Sharing failed — file downloaded instead.");
        downloadPdf();
      }
    }
  };

  // ── Validate & Publish ───────────────────────────────────
  const [publishState, setPublishState] = useState<"idle" | "publishing" | "published" | "error">("idle");
  const [publishError, setPublishError] = useState<string | null>(null);

  const publish = async () => {
    if (!sessionCode || !athlete?.id) {
      setPublishError("لا توجد جلسة أو رياضي نشط");
      setPublishState("error");
      return;
    }
    setPublishState("publishing");
    setPublishError(null);
    try {
      // Upsert match_results with published=true so the public display reveals it
      const payload = {
        match_mode: matchMode,
        confirmed_codes: confirmedCodes,
        flagged_codes: flaggedCodes,
        b_individual: bIndividualScores,
        c_movements: sheetData.cMovements,
        ta_oob_count: taOobCount,
        ta_deduction: 0,
        ta_info_deduction: taDeduction,
        chief_deduction: chiefDeduction,
        total_external_deduction: chiefDeduction,
        committed_at: sheetData.committedAt,
      };
      // Delete prior result for this athlete in this session, then insert fresh
      await supabase
        .from("match_results")
        .delete()
        .eq("session_code", sessionCode)
        .eq("athlete_id", athlete.id);

      const { error } = await supabase.from("match_results").insert({
        session_code: sessionCode,
        athlete_id: athlete.id,
        athlete_name: athlete.name,
        style: competitionStyle,
        score_a: groupAScore,
        score_b: groupBAverage,
        score_c: matchMode === "optional" ? groupCScore : null,
        deductions: chiefDeduction,
        final_score: finalScore,
        published: true,
        payload: payload as any,
      });
      if (error) throw error;

      // Also emit a match_event so the public scoreboard can react instantly
      await supabase.from("match_events").insert({
        session_code: sessionCode,
        event_type: "score_published",
        payload: { athlete_id: athlete.id, final_score: finalScore } as any,
      });

      setPublishState("published");
    } catch (e: any) {
      setPublishError(e?.message || "Publish failed");
      setPublishState("error");
    }
  };

  // ── Render ───────────────────────────────────────────────
  const Row = ({ label, value, color = "#fff" }: { label: string; value: string; color?: string }) => (
    <div className="flex items-center justify-between py-1 border-b border-white/5">
      <span className="text-[10px] uppercase tracking-wider text-white/50 font-body">{label}</span>
      <span className="text-sm font-heading font-black tabular-nums" style={{ color }} dir="ltr">{value}</span>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-3xl bg-[#0a0a0a] border relative animate-in fade-in zoom-in-95 duration-300"
        style={{ borderColor: `${GOLD}66`, boxShadow: `0 0 80px ${ORANGE}44` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" style={{ color: GOLD }} />
            <p className="text-sm font-heading font-black text-white tracking-wider">FINAL SCORE SHEET</p>
            <span
              className="ml-1 px-2 py-0.5 rounded text-[9px] font-heading font-black tracking-wider border"
              style={{ borderColor: `${ORANGE}66`, color: ORANGE, background: `${ORANGE}15` }}
            >
              {matchMode.toUpperCase()}
            </span>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="py-16 text-center text-white/40 text-sm">
              <Loader2 className="h-5 w-5 mx-auto animate-spin mb-2" />
              تحميل تفاصيل النتيجة…
            </div>
          ) : (
            <>
              {/* Athlete summary */}
              <div
                className="rounded-2xl border p-4"
                style={{ borderColor: `${GOLD}55`, background: `${GOLD}08` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-xl font-heading font-black text-white truncate">
                      {athlete?.name ?? "—"}
                    </h2>
                    <p className="text-[11px] text-white/60 font-body mt-1" dir="ltr">
                      {[bib && `Bib #${bib}`, athlete?.country, club, athlete?.category]
                        .filter(Boolean)
                        .join("  ·  ") || "—"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[9px] uppercase tracking-[0.3em] text-white/40 font-body">Final</p>
                    <p
                      className="text-4xl font-heading font-black tabular-nums leading-none"
                      style={{ color: ORANGE, textShadow: `0 0 20px ${ORANGE}80` }}
                      dir="ltr"
                    >
                      {finalScore.toFixed(3)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Group A */}
              <section>
                <p className="text-[10px] font-heading font-black tracking-[0.3em] mb-2" style={{ color: "#22c55e" }}>
                  GROUP A · QUALITY
                </p>
                <Row label="Group A score" value={`${groupAScore.toFixed(3)} / ${groupAMax.toFixed(3)}`} color="#22c55e" />
                <div className="mt-2">
                  <p className="text-[9px] uppercase tracking-wider text-emerald-400/80 font-body mb-1">
                    Confirmed (≥2 judges)
                  </p>
                  {confirmedCodes.length === 0 ? (
                    <p className="text-[11px] text-white/30 italic">— لا توجد —</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {confirmedCodes.map(c => (
                        <span
                          key={c.code}
                          className="px-2 py-0.5 rounded-md text-[10px] font-black tabular-nums border"
                          style={{
                            background: "rgba(16,185,129,0.15)",
                            borderColor: "rgba(16,185,129,0.55)",
                            color: "#6ee7b7",
                          }}
                          dir="ltr"
                          title={c.slots.join(", ")}
                        >
                          {c.code} ×{c.count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {flaggedCodes.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[9px] uppercase tracking-wider text-red-300/80 font-body mb-1">
                      Flagged · single judge (discarded)
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {flaggedCodes.map((f, i) => (
                        <span
                          key={`${f.code}-${i}`}
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold tabular-nums border line-through opacity-70"
                          style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.4)", color: "#fca5a5" }}
                          dir="ltr"
                        >
                          {f.code} ({f.slot})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              {/* Group B */}
              <section>
                <p className="text-[10px] font-heading font-black tracking-[0.3em] mb-2" style={{ color: GOLD }}>
                  GROUP B · PERFORMANCE
                </p>
                <Row label="Group B average (trimmed)" value={`${groupBAverage.toFixed(3)} / ${groupBMax.toFixed(3)}`} color={GOLD} />
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {bIndividualScores.length === 0 && (
                    <p className="col-span-full text-[11px] text-white/30 italic">— لا توجد إرسالات —</p>
                  )}
                  {bIndividualScores.map(b => {
                    const dropped = b.role === "high" || b.role === "low";
                    const color = dropped ? RED : b.role === "kept" ? GREEN : "#9ca3af";
                    return (
                      <div
                        key={b.slot}
                        className="rounded-xl border px-3 py-2 flex items-center justify-between"
                        style={{ borderColor: `${color}55`, background: `${color}10` }}
                      >
                        <div>
                          <p className="text-[10px] font-heading font-black text-white/80" dir="ltr">{b.slot}</p>
                          <p className="text-[8px] uppercase tracking-wider" style={{ color }}>
                            {dropped ? `Dropped (${b.role})` : b.role === "kept" ? "Counted" : "Single"}
                          </p>
                        </div>
                        <p className="text-base font-heading font-black tabular-nums" style={{ color }} dir="ltr">
                          {b.score === null ? "—" : b.score.toFixed(3)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Group C — only optional */}
              {matchMode === "optional" && (
                <section>
                  <p className="text-[10px] font-heading font-black tracking-[0.3em] mb-2" style={{ color: "#22d3ee" }}>
                    GROUP C · DIFFICULTY
                  </p>
                  <Row label="Group C score" value={`${groupCScore.toFixed(3)} / ${groupCMax.toFixed(3)}`} color="#22d3ee" />
                  <div className="mt-2 space-y-1">
                    {(athlete?.difficultySheet ?? []).length === 0 ? (
                      <p className="text-[11px] text-white/30 italic">— لا توجد حركات مسجلة —</p>
                    ) : (
                      (athlete?.difficultySheet ?? []).map((m, i) => (
                        <div
                          key={`${m.code}-${i}`}
                          className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1.5"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="px-1.5 rounded text-[10px] font-heading font-black tabular-nums"
                              style={{ background: "rgba(34,211,238,0.18)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.45)" }}
                              dir="ltr"
                            >
                              {m.code}
                            </span>
                            <span className="text-[11px] text-white/80 truncate" dir="ltr">{m.label}</span>
                            <span className="text-[9px] text-white/40 font-body" dir="ltr">{m.connection}</span>
                          </div>
                          <span className="text-[11px] font-heading font-black tabular-nums" style={{ color: "#22d3ee" }} dir="ltr">
                            +{m.value.toFixed(3)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              )}

              {/* TA */}
              <section>
                <p className="text-[10px] font-heading font-black tracking-[0.3em] mb-2 text-red-400">
                  TECHNICAL ASSISTANT · DEDUCTIONS
                </p>
                <Row label="Out of Bounds (OOB) events" value={String(taOobCount)} />
                <Row label="TA time suggestion · info only" value={taDeduction.toFixed(3)} color={RED} />
                <Row label="Chief Judge deduction · HD" value={`− ${chiefDeduction.toFixed(3)}`} color={RED} />
              </section>

              {/* Calculation */}
              <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-[10px] font-heading font-black tracking-[0.3em] text-white/70 mb-2">
                  FINAL CALCULATION
                </p>
                <Row label="Group A" value={groupAScore.toFixed(3)} />
                <Row label="Group B (avg)" value={groupBAverage.toFixed(3)} />
                {matchMode === "optional" && <Row label="Group C" value={groupCScore.toFixed(3)} />}
                <Row label="TA deduction · info only" value="0.000" color={RED} />
                <Row label="Chief Judge deduction · HD" value={`− ${chiefDeduction.toFixed(3)}`} color={RED} />
                <div className="mt-2 pt-2 border-t border-white/15 flex items-center justify-between">
                  <span className="text-xs font-heading font-black tracking-wider text-white">FINAL SCORE</span>
                  <span
                    className="text-3xl font-heading font-black tabular-nums"
                    style={{ color: ORANGE, textShadow: `0 0 16px ${ORANGE}80` }}
                    dir="ltr"
                  >
                    {finalScore.toFixed(3)}
                  </span>
                </div>
              </section>

              {shareError && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-300 flex items-start gap-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{shareError}</span>
                </div>
              )}
              {publishError && (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-300 flex items-start gap-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{publishError}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-white/10 flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={downloadPdf}
            className="h-10 px-4 rounded-xl bg-white/5 border border-white/15 text-white text-xs font-heading font-black tracking-wider flex items-center gap-2 hover:bg-white/10 transition-all"
          >
            <Download className="h-3.5 w-3.5" />
            تحميل PDF
          </button>
          <button
            onClick={sharePdf}
            className="h-10 px-4 rounded-xl text-xs font-heading font-black tracking-wider flex items-center gap-2 transition-all hover:brightness-110"
            style={{ background: `${GOLD}1A`, border: `1px solid ${GOLD}66`, color: GOLD }}
          >
            <Share2 className="h-3.5 w-3.5" />
            Export & Share
          </button>
          <div className="flex-1" />
          {publishState === "published" ? (
            <div
              className="h-10 px-5 rounded-xl flex items-center gap-2 text-xs font-heading font-black tracking-wider"
              style={{ background: `${GREEN}22`, border: `1px solid ${GREEN}88`, color: "#6ee7b7" }}
            >
              <CheckCircle className="h-3.5 w-3.5" />
              PUBLISHED · LIVE
            </div>
          ) : (
            <button
              onClick={publish}
              disabled={publishState === "publishing"}
              className="h-10 px-5 rounded-xl font-heading font-black text-xs tracking-[0.2em] flex items-center gap-2 transition-all hover:brightness-110 disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${GOLD}, ${ORANGE})`,
                color: NAVY,
                boxShadow: `0 0 20px ${ORANGE}55`,
              }}
            >
              {publishState === "publishing" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Tv className="h-3.5 w-3.5" />
              )}
              VALIDATE &amp; PUBLISH
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
