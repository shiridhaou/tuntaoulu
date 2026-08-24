import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FederationLogo } from "@/components/FederationLogo";
import { getAdviceForCode, analyzeContext } from "@/lib/adviceData";
import { exportReportToPdf } from "@/lib/pdfExport";
import { Trophy, Sparkles, AlertTriangle, ArrowLeft, Loader2, Download, Share2 } from "lucide-react";

export const Route = createFileRoute("/public-report/$id")({
  head: () => ({
    meta: [
      { title: "Smart Report — تقرير الذكاء الاصطناعي" },
      { name: "description", content: "تقرير الأداء التفصيلي للرياضي مع نصائح الذكاء الاصطناعي" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
    ],
  }),
  component: PublicReportPage,
  errorComponent: ({ error }) => (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
      <AlertTriangle className="h-12 w-12 text-orange-400 mb-4" />
      <p className="text-sm text-white/60">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <p>Report not found</p>
    </div>
  ),
});

const NAVY = "#0A192F";
const GOLD = "#D4AF37";
const ORANGE = "#FF7A1A";
const GREEN = "#22c55e";
const CYAN = "#22d3ee";
const RED = "#ef4444";

type Result = {
  athlete_id: string;
  athlete_name: string | null;
  style: string | null;
  score_a: number | null;
  score_b: number | null;
  score_c: number | null;
  deductions: number | null;
  final_score: number;
  payload: {
    ta_oob_count?: number;
    match_mode?: string;
    confirmed_codes?: { code: string; count?: number; slots?: string[] }[];
    flagged_codes?: { code: string; slot?: string }[];
    b_individual?: { slot: string; score: number | null; role?: "high" | "low" | "kept" | "single" }[];
    c_movements?: { code: string; successful?: boolean | null; success?: boolean | null }[];
  } | null;
  session_code: string;
  updated_at: string;
};

type JudgeScore = {
  judge_slot: string;
  judge_role: string;
  score: number | null;
  payload: { codes?: string[]; attempts?: { code: string; successful?: boolean }[] } | null;
};

function PublicReportPage() {
  const { id } = Route.useParams();
  const [result, setResult] = useState<Result | null>(null);
  const [athlete, setAthlete] = useState<{ full_name: string; country: string | null; club: string | null; age_category: string | null; bib_number: string | null; style: string | null } | null>(null);
  const [judgeScores, setJudgeScores] = useState<JudgeScore[]>([]);
  const [loading, setLoading] = useState(true);
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = async () => {
    // Published reports are served through a scoped RPC so match, athlete and
    // judge data are not publicly readable across sessions.
    const { data: report } = await supabase.rpc("get_public_report", { _athlete_id: id });
    const rep = (report ?? null) as {
      result: Result | null;
      athlete: typeof athlete;
      judge_scores: JudgeScore[];
    } | null;
    setResult(rep?.result ?? null);
    setAthlete(rep?.athlete ?? null);
    setJudgeScores(rep?.judge_scores ?? []);
    setLoading(false);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => { if (!cancelled) await load(); })();
    // Realtime: listen for new publishes for this athlete
    const ch = supabase
      .channel(`report-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_results", filter: `athlete_id=eq.${id}` }, () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ── Derived breakdown from judge_scores (mirrors PublicDisplay logic) ──
  const breakdown = useMemo(() => {
    // Group A: codes confirmed — threshold adapts to active A-judge count
    const aJudges = judgeScores.filter(j => j.judge_role === "A" || j.judge_slot.startsWith("A"));
    const activeAJudgeCount = new Set(aJudges.map(j => j.judge_slot)).size;
    const threshold = activeAJudgeCount >= 3 ? 2 : 1;
    const codeCount = new Map<string, { count: number; slots: string[] }>();
    aJudges.forEach(j => {
      const codes: string[] = Array.isArray(j.payload?.codes) ? (j.payload!.codes as string[]) : [];
      codes.forEach(code => {
        const cur = codeCount.get(code) ?? { count: 0, slots: [] };
        cur.count += 1;
        cur.slots.push(j.judge_slot);
        codeCount.set(code, cur);
      });
    });
    const confirmedCodes: { code: string; count: number; slots: string[] }[] = [];
    const flaggedCodes: { code: string; slot: string }[] = [];
    codeCount.forEach((v, k) => {
      if (v.count >= threshold) confirmedCodes.push({ code: k, count: v.count, slots: v.slots });
      else flaggedCodes.push({ code: k, slot: v.slots[0] });
    });

    // Group B individuals + trim
    const bs = judgeScores.filter(j => (j.judge_role === "B" || j.judge_slot.startsWith("B")) && j.score !== null)
      .map(j => ({ slot: j.judge_slot, score: Number(j.score) }))
      .sort((a, b) => a.slot.localeCompare(b.slot));
    const bRoles: Record<string, "high" | "low" | "kept" | "single"> = {};
    if (bs.length < 3) bs.forEach(b => (bRoles[b.slot] = "single"));
    else {
      const max = Math.max(...bs.map(b => b.score));
      const min = Math.min(...bs.map(b => b.score));
      let highTaken = false, lowTaken = false;
      bs.forEach(b => {
        if (!highTaken && b.score === max) { bRoles[b.slot] = "high"; highTaken = true; }
        else if (!lowTaken && b.score === min) { bRoles[b.slot] = "low"; lowTaken = true; }
        else bRoles[b.slot] = "kept";
      });
    }
    const bIndividual = bs.map(b => ({ ...b, role: bRoles[b.slot] }));

    // Group C attempts → majority success
    const successMap = new Map<string, number>();
    const totalMap = new Map<string, number>();
    judgeScores.filter(j => j.judge_role === "C" || j.judge_slot.startsWith("C")).forEach(j => {
      const attempts = Array.isArray(j.payload?.attempts) ? j.payload!.attempts! : [];
      attempts.forEach((a) => {
        if (!a?.code) return;
        totalMap.set(a.code, (totalMap.get(a.code) ?? 0) + 1);
        if (a.successful) successMap.set(a.code, (successMap.get(a.code) ?? 0) + 1);
      });
    });
    const cMovements: { code: string; success: boolean | null }[] = [];
    totalMap.forEach((t, code) => {
      const s = successMap.get(code) ?? 0;
      cMovements.push({ code, success: t > 0 ? s >= Math.ceil(t / 2) : null });
    });

    return { confirmedCodes, flaggedCodes, bIndividual, cMovements };
  }, [judgeScores]);

  const handleDownload = async () => {
    if (!reportRef.current) return;
    setDownloading(true);
    try {
      await exportReportToPdf(reportRef.current, athlete?.full_name ?? result?.athlete_name ?? "athlete");
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    const title = `Wushu Smart Report — ${athlete?.full_name ?? result?.athlete_name ?? "Athlete"}`;
    const url = window.location.href;
    const text = `${title}\nScore: ${Number(result?.final_score ?? 0).toFixed(2)}\n${url}`;
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ title, text, url });
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch { /* user cancelled */ }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: GOLD }} />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
        <FederationLogo size="md" />
        <AlertTriangle className="h-12 w-12 mt-8 mb-4" style={{ color: ORANGE }} />
        <h1 className="font-heading font-black text-xl mb-2" style={{ color: GOLD }}>التقرير لم يُنشر بعد</h1>
        <p className="text-white/60 max-w-sm mb-6 text-sm">
          ينشر الحكم الرئيسي النتيجة، ثم تُحدَّث هذه الصفحة تلقائياً.
        </p>
        <Link to="/" className="px-5 py-2 rounded-lg border text-xs font-heading font-bold tracking-wider" style={{ borderColor: GOLD, color: GOLD }}>
          <ArrowLeft className="inline h-4 w-4 ml-2" /> العودة
        </Link>
      </div>
    );
  }

  const matchMode = (result.payload?.match_mode ?? "compulsory") as "compulsory" | "optional";
  const oob = result.payload?.ta_oob_count ?? 0;
  const confirmedForReport = breakdown.confirmedCodes.length > 0
    ? breakdown.confirmedCodes
    : (result.payload?.confirmed_codes ?? []).map(c => ({ code: c.code, count: Number(c.count ?? 1), slots: c.slots ?? [] }));
  const flaggedForReport = breakdown.flaggedCodes.length > 0
    ? breakdown.flaggedCodes
    : (result.payload?.flagged_codes ?? []).map(f => ({ code: f.code, slot: f.slot ?? "" }));
  const bIndividualForReport = breakdown.bIndividual.length > 0
    ? breakdown.bIndividual
    : (result.payload?.b_individual ?? [])
        .filter(b => b.score !== null)
        .map(b => ({ slot: b.slot, score: Number(b.score), role: b.role ?? "single" }));
  const cMovementsForReport = breakdown.cMovements.length > 0
    ? breakdown.cMovements
    : (result.payload?.c_movements ?? []).map(m => ({ code: m.code, success: typeof m.successful === "boolean" ? m.successful : typeof m.success === "boolean" ? m.success : null }));
  const codes = confirmedForReport.map(c => ({ code: c.code, count: c.count }));
  const advices = codes.map(c => ({ ...c, advice: getAdviceForCode(c.code) }));
  const insights = analyzeContext(
    codes.map(c => ({ code: c.code, value: 0.1 * c.count, timeSec: 0 })),
    60,
  );

  return (
    <div className="min-h-screen text-white pb-12 relative overflow-hidden"
      style={{ background: `radial-gradient(circle at 20% 10%, ${ORANGE}22, transparent 60%), radial-gradient(circle at 80% 90%, ${GOLD}10, transparent 55%), ${NAVY}` }}>
      {/* Header */}
      <header className="px-5 pt-5 pb-4 border-b backdrop-blur-md bg-black/20" style={{ borderColor: `${GOLD}22` }}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FederationLogo size="sm" />
            <div className="leading-tight">
              <p className="text-[9px] uppercase tracking-[0.25em] text-white/50">Tunisian Wushu</p>
              <p className="text-xs font-heading font-black" style={{ color: GOLD }}>CHAMPIONSHIPS 2024</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-heading font-black tracking-[0.2em] hover:bg-white/5 transition-colors disabled:opacity-50"
              style={{ borderColor: `${GOLD}66`, color: GOLD }}
            >
              {downloading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
              <span>PDF</span>
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 transition-colors"
              title="Share report link"
            >
              <Share2 className="h-3 w-3" />
              <span className="text-[10px] font-heading font-black tracking-[0.2em]">SHARE</span>
            </button>
          </div>
        </div>
      </header>

      <main ref={reportRef} className="px-4 pt-5 max-w-2xl mx-auto space-y-4">
        {/* Hero — Athlete + Final Score */}
        <section className="rounded-3xl border p-5 backdrop-blur-md"
          style={{ borderColor: `${GOLD}66`, background: `${GOLD}08`, boxShadow: `0 0 40px ${ORANGE}33` }}>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {athlete?.bib_number && (
              <span className="px-2 py-0.5 rounded text-[10px] font-heading font-black tabular-nums border border-white/20 bg-white/5 text-white/70" dir="ltr">
                BIB #{athlete.bib_number}
              </span>
            )}
            {athlete?.country && (
              <span className="px-2 py-0.5 rounded text-[10px] font-heading font-black border" style={{ borderColor: `${ORANGE}66`, color: ORANGE, background: `${ORANGE}15` }} dir="ltr">
                {athlete.country}
              </span>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-heading font-black text-white leading-tight">
            {result.athlete_name ?? athlete?.full_name ?? "—"}
          </h1>
          <p className="mt-1 text-[11px] text-white/60 font-body" dir="ltr">
            {[athlete?.club, athlete?.age_category, (result.style ?? athlete?.style)?.toUpperCase()].filter(Boolean).join("  ·  ") || "—"}
          </p>

          <div className="mt-4 flex items-end justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4" style={{ color: GOLD }} />
              <p className="text-[10px] font-heading tracking-[0.3em] text-white/60">FINAL SCORE</p>
            </div>
            <p className="text-6xl md:text-7xl font-heading font-black tabular-nums leading-none"
              style={{ color: "#FACC15", textShadow: "none" }} dir="ltr">
              {Number(result.final_score).toFixed(2)}
            </p>
          </div>
        </section>

        {/* Group A */}
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-heading font-black tracking-[0.3em] text-emerald-400">GROUP A · QUALITY</p>
            <p className="text-xl font-heading font-black tabular-nums" style={{ color: GREEN }} dir="ltr">
              {Number(result.score_a ?? 0).toFixed(2)} <span className="text-xs text-white/40">/ 5.00</span>
            </p>
          </div>
          <p className="text-[9px] uppercase tracking-wider text-emerald-300/80 font-body mb-1.5">
            Confirmed deductions (≥ 2 judges)
          </p>
          {confirmedForReport.length === 0 ? (
            <p className="text-[11px] text-white/40 italic">— لا توجد —</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {confirmedForReport.map(c => (
                <span key={c.code} className="px-2.5 py-0.5 rounded-lg text-[11px] font-heading font-black tabular-nums border"
                  style={{ background: "rgba(16,185,129,0.18)", borderColor: "rgba(16,185,129,0.6)", color: "#6ee7b7" }} dir="ltr">
                  {c.code} ×{c.count}
                </span>
              ))}
            </div>
          )}
          {flaggedForReport.length > 0 && (
            <div className="mt-2">
              <p className="text-[9px] uppercase tracking-wider text-red-300/80 font-body mb-1">Flagged · single judge</p>
              <div className="flex flex-wrap gap-1">
                {flaggedForReport.map((f, i) => (
                  <span key={`${f.code}-${i}`} className="px-1.5 py-0 rounded text-[10px] font-bold tabular-nums border line-through opacity-70"
                    style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.4)", color: "#fca5a5" }} dir="ltr">
                    {f.code} ({f.slot})
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Group B */}
        <section className="rounded-2xl border p-4" style={{ borderColor: `${GOLD}40`, background: `${GOLD}08` }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-heading font-black tracking-[0.3em]" style={{ color: GOLD }}>GROUP B · PERFORMANCE</p>
            <p className="text-xl font-heading font-black tabular-nums" style={{ color: GOLD }} dir="ltr">
              {Number(result.score_b ?? 0).toFixed(2)} <span className="text-xs text-white/40">/ 3.00</span>
            </p>
          </div>
          {bIndividualForReport.length === 0 ? (
            <p className="text-[11px] text-white/40 italic">— لا توجد إرسالات —</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {bIndividualForReport.map(b => {
                const dropped = b.role === "high" || b.role === "low";
                const color = dropped ? RED : b.role === "kept" ? GREEN : "#9ca3af";
                return (
                  <div key={b.slot} className="rounded-lg border px-2 py-1.5 flex items-center justify-between"
                    style={{ borderColor: `${color}66`, background: `${color}12` }}>
                    <div>
                      <p className="text-[10px] font-heading font-black text-white/85" dir="ltr">{b.slot}</p>
                      <p className="text-[8px] uppercase tracking-wider" style={{ color }}>
                        {dropped ? `Drop` : b.role === "kept" ? "Counted" : "Single"}
                      </p>
                    </div>
                    <p className="text-base font-heading font-black tabular-nums" style={{ color }} dir="ltr">
                      {b.score.toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Group C */}
        {matchMode === "optional" && (
          <section className="rounded-2xl border border-cyan-400/30 bg-cyan-400/[0.04] p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-heading font-black tracking-[0.3em]" style={{ color: CYAN }}>GROUP C · DIFFICULTY</p>
              <p className="text-xl font-heading font-black tabular-nums" style={{ color: CYAN }} dir="ltr">
                {Number(result.score_c ?? 0).toFixed(2)} <span className="text-xs text-white/40">/ 2.00</span>
              </p>
            </div>
            {cMovementsForReport.length === 0 ? (
              <p className="text-[11px] text-white/40 italic">— لا توجد حركات —</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {cMovementsForReport.map((m, i) => (
                  <span key={`${m.code}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-heading font-black tabular-nums border"
                    style={{
                      background: m.success === true ? "rgba(34,211,238,0.18)" : m.success === false ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.04)",
                      borderColor: m.success === true ? "rgba(34,211,238,0.6)" : m.success === false ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.15)",
                      color: m.success === true ? "#67e8f9" : m.success === false ? "#fca5a5" : "rgba(255,255,255,0.5)",
                    }} dir="ltr">
                    <span className={m.success === false ? "line-through" : ""}>{m.code}</span>
                    <span className="text-[9px] opacity-80">{m.success === true ? "✓" : m.success === false ? "✗" : "—"}</span>
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {/* TA */}
        {(Number(result.deductions ?? 0) > 0 || oob > 0) && (
          <section className="rounded-2xl border border-red-500/30 bg-red-500/[0.05] p-4">
            <p className="text-[10px] font-heading font-black tracking-[0.3em] text-red-400 mb-1.5">TA · DEDUCTIONS</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[11px] uppercase tracking-wider text-white/60">OOB ×{oob}</span>
              <span className="font-heading font-black tabular-nums" style={{ color: RED }} dir="ltr">
                − {Number(result.deductions ?? 0).toFixed(2)}
              </span>
            </div>
          </section>
        )}

        {/* AI Section */}
        <section className="pt-2">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4" style={{ color: GOLD }} />
            <h2 className="font-heading font-black text-base" style={{ color: GOLD }}>تحليل الذكاء الاصطناعي</h2>
            <span className="text-xs text-white/40">— Smart AI Analysis</span>
          </div>

          {advices.length === 0 ? (
            <div className="rounded-xl p-4 text-center text-sm text-white/60"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              ✨ Performance propre — aucune déduction technique majeure.
            </div>
          ) : (
            <div className="space-y-2.5">
              {advices.map(({ code, count, advice }) => (
                <article key={code} className="rounded-xl p-3.5"
                  style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${GOLD}26` }}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-heading font-black tracking-[0.15em]"
                          style={{ background: `${GOLD}1F`, border: `1px solid ${GOLD}66`, color: GOLD }}>
                          <Sparkles className="h-2.5 w-2.5" /> AI
                        </span>
                        <p className="text-[10px] font-heading tracking-wider" style={{ color: GOLD }}>
                          Code {code} — {advice.category}
                        </p>
                      </div>
                      <p className="font-heading font-bold text-sm">{advice.titleFr}</p>
                      <p className="text-xs text-white/50">{advice.titleAr}</p>
                    </div>
                    <p className="text-[10px] text-white/40 shrink-0">×{count}</p>
                  </div>
                  <p className="text-sm leading-relaxed text-white/85" dir="rtl">{advice.advice}</p>
                </article>
              ))}
            </div>
          )}

          {insights.length > 0 && (
            <div className="space-y-2.5 mt-3">
              {insights.map(ins => (
                <article key={ins.id} className="rounded-xl p-3.5"
                  style={{ background: `linear-gradient(135deg, ${ORANGE}12, transparent)`, border: `1px solid ${ORANGE}30` }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xl">{ins.emoji}</span>
                    <div className="flex-1">
                      <p className="font-heading font-bold text-sm">{ins.titleFr}</p>
                      <p className="text-xs text-white/50">{ins.titleAr}</p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-white/85" dir="rtl">{ins.advice}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="text-center text-[10px] text-white/40 mt-4 tracking-wider">
          Rapport généré le {new Date(result.updated_at).toLocaleString("fr-TN")}
        </p>
      </main>
    </div>
  );
}
