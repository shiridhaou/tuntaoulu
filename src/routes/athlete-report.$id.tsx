import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useCompetition, STYLE_CONFIGS } from "@/store/competition-store";
import { FederationLogo } from "@/components/FederationLogo";
import { ReportCharts } from "@/components/ReportCharts";
import { exportReportToPdf } from "@/lib/pdfExport";
import { getAdviceForCode, analyzeContext, buildWhatsAppMessage } from "@/lib/adviceData";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Sparkles, Share2, ArrowLeft, AlertTriangle, Download, Loader2, PlayCircle, X } from "lucide-react";

export const Route = createFileRoute("/athlete-report/$id")({
  head: () => ({
    meta: [
      { title: "تقرير اللاعب — Smart Report" },
      { name: "description", content: "تقرير الأداء التفصيلي مع نصائح الذكاء الاصطناعي" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
    ],
  }),
  component: AthleteReportPage,
});

const GOLD = "#D4AF37";
const ORANGE = "#FF7A1A";

function AthleteReportPage() {
  const { id } = Route.useParams();
  const { getReport, sessionCode } = useCompetition();
  const report = getReport(id);
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [verifiedClips, setVerifiedClips] = useState<Array<{ code: string; url: string; verifiedAt: number }>>([]);
  const [activeReplayUrl, setActiveReplayUrl] = useState<string | null>(null);

  // Fetch verified VAR clips for this athlete from match_events
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Build query: match by athleteId in payload, only verified events.
      // We don't strictly need sessionCode (athleteId is unique), but use it when available.
      let q = supabase
        .from("match_events")
        .select("payload, created_at")
        .eq("event_type", "ahj_clip_verified")
        .order("created_at", { ascending: true });
      if (sessionCode) q = q.eq("session_code", sessionCode);
      const { data } = await q;
      if (cancelled || !data) return;
      const out: Array<{ code: string; url: string; verifiedAt: number }> = [];
      for (const row of data) {
        const p = (row.payload ?? {}) as Record<string, unknown>;
        if (p.athleteId !== id) continue;
        const url = typeof p.clipUrl === "string" ? p.clipUrl : null;
        const code = typeof p.deductionCode === "string" ? p.deductionCode : null;
        if (!url || !code) continue;
        out.push({ code, url, verifiedAt: Number(p.verifiedAt ?? Date.parse(row.created_at)) });
      }
      setVerifiedClips(out);
    })();
    return () => { cancelled = true; };
  }, [id, sessionCode]);

  if (!report) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 text-center">
        <FederationLogo size="md" />
        <AlertTriangle className="h-12 w-12 mt-8 mb-4" style={{ color: ORANGE }} />
        <h1 className="font-heading font-black text-2xl mb-2" style={{ color: GOLD }}>
          Rapport introuvable
        </h1>
        <p className="text-white/60 max-w-sm mb-6">
          ما لقيناش تقرير لهذا اللاعب. يمكن العرض ما تمّاش COMMIT بعد، ولا الرابط قديم.
        </p>
        <Link to="/" className="px-5 py-2.5 rounded-lg border text-sm font-heading font-bold tracking-wider"
          style={{ borderColor: GOLD, color: GOLD }}>
          <ArrowLeft className="inline h-4 w-4 ml-2" /> العودة
        </Link>
      </div>
    );
  }

  const styleCfg = STYLE_CONFIGS[report.style ?? "changquan"] ?? STYLE_CONFIGS.changquan;

  const insights = analyzeContext(
    report.deductions.map(d => ({ code: d.code, value: d.value, timeSec: d.timeSec })),
    report.performanceTime,
  );

  const codeAdvices = report.deductions.map(d => ({
    deduction: d,
    advice: getAdviceForCode(d.code),
  }));

  const uniqueAdviceMap = new Map<string, { advice: ReturnType<typeof getAdviceForCode>; count: number; total: number }>();
  for (const ca of codeAdvices) {
    const key = ca.advice.code;
    const existing = uniqueAdviceMap.get(key);
    if (existing) {
      existing.count += 1;
      existing.total += ca.deduction.value;
    } else {
      uniqueAdviceMap.set(key, { advice: ca.advice, count: 1, total: ca.deduction.value });
    }
  }
  const uniqueAdvices = Array.from(uniqueAdviceMap.values());
  const topAdvice = uniqueAdvices[0]?.advice.advice ?? insights[0]?.advice;

  const shareWhatsApp = () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const msg = buildWhatsAppMessage({
      athleteName: report.athleteName,
      finalScore: report.finalScore,
      reportUrl: url,
      topAdvice,
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener");
  };

  const handleExportPdf = async () => {
    if (!reportRef.current || exporting) return;
    setExporting(true);
    try {
      await exportReportToPdf(reportRef.current, report.athleteName);
    } catch (e) {
      console.error("PDF export failed:", e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white pb-12">
      <div ref={reportRef} className="bg-black">
        {/* Header */}
        <header className="px-5 pt-6 pb-5 border-b" style={{ borderColor: `${GOLD}33` }}>
          <div className="flex items-center gap-3 mb-4">
            <img src="/images/federation-logo.jfif" alt="logo"
              className="h-12 w-12 rounded-full object-cover ring-2"
              style={{ boxShadow: `0 0 0 2px ${GOLD}` }} />
            <div className="flex-1 text-right">
              <p className="text-[10px] font-heading tracking-[0.25em] text-white/50">RAPPORT IA</p>
              <p className="text-sm font-bold" style={{ color: GOLD }}>الجامعة التونسية للووشو كونغ فو</p>
            </div>
          </div>
          <h1 className="font-heading font-black text-2xl leading-tight">{report.athleteName}</h1>
          <p className="text-sm text-white/60 mt-1">
            {report.country} • {report.category} • <span className="uppercase">{report.style}</span>
          </p>
        </header>

        {/* Performance Score */}
        <section className="px-5 py-6">
          <div className="rounded-2xl p-6 text-center"
            style={{ background: "linear-gradient(135deg, rgba(212,175,55,0.08), rgba(255,122,26,0.05))",
                     border: `1px solid ${GOLD}40`,
                     boxShadow: `0 0 30px ${ORANGE}20` }}>
            <div className="flex items-center justify-center gap-2 mb-2">
              <Trophy className="h-4 w-4" style={{ color: GOLD }} />
              <p className="text-[10px] font-heading tracking-[0.3em] text-white/60">PERFORMANCE SCORE</p>
            </div>
            <div className="font-heading font-black text-7xl tabular-nums tracking-tight"
              style={{ color: ORANGE, textShadow: `0 0 40px ${ORANGE}80` }}>
              {report.finalScore.toFixed(3)}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-5 pt-5 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <Stat label="Quality A" value={report.judgeAScore} />
              <Stat label="Performance B" value={report.judgeBAverage} />
              <Stat label="Difficulty C" value={report.judgeCScore} />
            </div>
          </div>
        </section>

        {/* Visual Analytics */}
        <section className="px-5 pb-6">
          <SectionTitle fr="Analyse Visuelle" ar="التحليل البصري" />
          <ReportCharts
            judgeAScore={report.judgeAScore}
            judgeBAverage={report.judgeBAverage}
            judgeCScore={report.judgeCScore}
            maxA={styleCfg.maxA}
            maxB={styleCfg.maxB}
            maxC={styleCfg.maxC}
            deductions={report.deductions}
            performanceTime={report.performanceTime}
          />
        </section>

        {/* Analyse Technique */}
        <section className="px-5 pb-6">
          <SectionTitle fr="Analyse Technique" ar="التحليل الفني" />
          {uniqueAdvices.length === 0 ? (
            <div className="rounded-xl p-5 text-center text-sm text-white/60"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
              ✨ Performance propre — aucune déduction technique majeure.
            </div>
          ) : (
            <div className="space-y-3">
              {uniqueAdvices.map(({ advice, count, total }) => (
                <article key={advice.code} className="rounded-xl p-4"
                  style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${GOLD}26` }}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <AiBadge />
                        <p className="text-[10px] font-heading tracking-wider" style={{ color: GOLD }}>
                          Code {advice.code} — {advice.category}
                        </p>
                      </div>
                      <p className="font-heading font-bold text-sm">{advice.titleFr}</p>
                      <p className="text-xs text-white/50">{advice.titleAr}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-white/40">×{count}</p>
                      <p className="font-heading font-black text-sm" style={{ color: ORANGE }}>−{total.toFixed(1)}</p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-white/85" dir="rtl">
                    {advice.advice}
                  </p>
                  {/* Play Replay buttons for verified VAR clips matching this deduction code */}
                  {(() => {
                    const matches = verifiedClips.filter(c => c.code === advice.code);
                    if (matches.length === 0) return null;
                    return (
                      <div className="mt-3 flex flex-wrap gap-2" data-html2canvas-ignore="true">
                        {matches.map((m, idx) => (
                          <button
                            key={`${m.url}-${idx}`}
                            onClick={() => setActiveReplayUrl(m.url)}
                            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-heading font-bold transition-transform active:scale-95"
                            style={{ background: `${ORANGE}1A`, border: `1px solid ${ORANGE}66`, color: ORANGE }}
                          >
                            <PlayCircle className="h-3.5 w-3.5" />
                            Play Replay {matches.length > 1 ? `#${idx + 1}` : ""} • 7s
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Conseils AI — contextual */}
        {insights.length > 0 && (
          <section className="px-5 pb-6">
            <SectionTitle fr="Conseils AI" ar="نصائح الذكاء الاصطناعي" />
            <div className="space-y-3">
              {insights.map(ins => (
                <article key={ins.id} className="rounded-xl p-4"
                  style={{ background: `linear-gradient(135deg, ${ORANGE}12, transparent)`,
                           border: `1px solid ${ORANGE}30` }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{ins.emoji}</span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <AiBadge />
                        <p className="font-heading font-bold text-sm">{ins.titleFr}</p>
                      </div>
                      <p className="text-xs text-white/50 mt-0.5">{ins.titleAr}</p>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-white/85" dir="rtl">{ins.advice}</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Actions (outside ref, not in PDF) */}
      <section className="px-5 pt-2 space-y-3">
        <button onClick={shareWhatsApp}
          className="w-full h-12 rounded-xl font-heading font-bold text-sm tracking-wider flex items-center justify-center gap-2 transition-transform active:scale-95"
          style={{ background: "#25D366", color: "#000" }}>
          <Share2 className="h-4 w-4" />
          Partager via WhatsApp
        </button>
        <button onClick={handleExportPdf} disabled={exporting}
          className="w-full h-12 rounded-xl font-heading font-bold text-sm tracking-wider flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-60"
          style={{ background: `linear-gradient(135deg, ${GOLD}, ${ORANGE})`, color: "#000" }}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {exporting ? "Génération..." : "Download PDF Report"}
        </button>
        <p className="text-center text-[10px] text-white/40 mt-3 tracking-wider">
          Rapport généré le {new Date(report.committedAt).toLocaleString("fr-TN")}
        </p>
      </section>

      {/* Replay modal */}
      {activeReplayUrl && (
        <div
          className="fixed inset-0 z-[80] bg-black/90 backdrop-blur flex items-center justify-center p-4"
          onClick={() => setActiveReplayUrl(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-2xl overflow-hidden border bg-black"
            style={{ borderColor: `${ORANGE}66`, boxShadow: `0 0 60px ${ORANGE}55` }}
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <PlayCircle className="h-4 w-4" style={{ color: ORANGE }} />
                <span className="text-xs font-heading font-black tracking-[0.2em]" style={{ color: ORANGE }}>
                  VAR REPLAY • 7s
                </span>
              </div>
              <button
                onClick={() => setActiveReplayUrl(null)}
                className="h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <video src={activeReplayUrl} controls autoPlay playsInline className="w-full aspect-video bg-black" />
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[9px] font-heading tracking-[0.2em] text-white/40">{label}</p>
      <p className="font-heading font-black text-lg tabular-nums" style={{ color: GOLD }}>
        {value.toFixed(3)}
      </p>
    </div>
  );
}

function SectionTitle({ fr, ar }: { fr: string; ar: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Sparkles className="h-4 w-4" style={{ color: GOLD }} />
      <h2 className="font-heading font-black text-base" style={{ color: GOLD }}>{fr}</h2>
      <span className="text-xs text-white/40">— {ar}</span>
    </div>
  );
}

function AiBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-heading font-black tracking-[0.15em]"
      style={{ background: `${GOLD}1F`, border: `1px solid ${GOLD}66`, color: GOLD }}
    >
      <Sparkles className="h-2.5 w-2.5" />
      AI INSIGHT
    </span>
  );
}
