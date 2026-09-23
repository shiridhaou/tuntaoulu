import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { affiliationLabel, countryCode, countryFlag } from "@/lib/affiliation";
import { styleLabelAr } from "@/lib/styleNames";
import { X, Trophy, RefreshCw, Printer } from "lucide-react";

/**
 * READ-ONLY event standings overlay (Chief console + public screen).
 * Reads published `match_results` rows for the session and ranks them.
 * It never writes, resets or touches live scoring / Judge C progression.
 */

export interface LeaderboardRow {
  athleteId: string;
  name: string;
  club: string | null;
  country: string | null;
  style: string | null;
  scoreA: number;
  scoreB: number;
  scoreC: number;
  deductions: number;
  finalScore: number;
  /** Athlete marked DNS / Absent — rendered with a "DNS" label, ranked last. */
  dns?: boolean;
}

/** IWUF-style ordering: final score, then C, then B, then A, then name. DNS always last. */
export function rankRows(rows: LeaderboardRow[]): LeaderboardRow[] {
  return [...rows].sort(
    (x, y) =>
      Number(x.dns ?? false) - Number(y.dns ?? false) ||
      y.finalScore - x.finalScore ||
      y.scoreC - x.scoreC ||
      y.scoreB - x.scoreB ||
      y.scoreA - x.scoreA ||
      x.name.localeCompare(y.name),
  );
}

const MEDAL = ["#FACC15", "#CBD5E1", "#D97706"];

export function LeaderboardModal({
  sessionCode,
  open,
  onClose,
  styleFilter,
  eventTitle,
  categoryTitle,
  displayMode = "console",
}: {
  sessionCode: string | null;
  open: boolean;
  onClose: () => void;
  styleFilter?: string | null;
  eventTitle?: string;
  categoryTitle?: string;
  displayMode?: "console" | "arena";
}) {
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const code = (sessionCode ?? "").trim().toUpperCase();
    if (!code) { setRows([]); return; }
    setLoading(true);
    try {
      const { data } = await supabase
        .from("match_results")
        .select("athlete_id, athlete_name, style, score_a, score_b, score_c, deductions, final_score, updated_at, payload")
        .eq("session_code", code)
        .eq("published", true)
        .order("updated_at", { ascending: false });

      const results = (data ?? []) as Array<{
        athlete_id: string; athlete_name: string | null; style: string | null;
        score_a: number | null; score_b: number | null; score_c: number | null;
        deductions: number | null; final_score: number;
        payload: { status?: string } | null;
      }>;

      // Keep only the latest published row per athlete.
      const latest = new Map<string, typeof results[number]>();
      for (const r of results) if (!latest.has(r.athlete_id)) latest.set(r.athlete_id, r);

      const ids = [...latest.keys()];
      const meta = new Map<string, { full_name: string; club: string | null; country: string | null }>();
      if (ids.length) {
        const { data: ath } = await supabase
          .from("athletes")
          .select("id, full_name, club, country")
          .in("id", ids);
        for (const a of (ath ?? []) as Array<{ id: string; full_name: string; club: string | null; country: string | null }>) {
          meta.set(a.id, { full_name: a.full_name, club: a.club, country: a.country });
        }
      }

      const built: LeaderboardRow[] = [...latest.values()].map((r) => ({
        athleteId: r.athlete_id,
        name: meta.get(r.athlete_id)?.full_name ?? r.athlete_name ?? "—",
        club: meta.get(r.athlete_id)?.club ?? null,
        country: meta.get(r.athlete_id)?.country ?? null,
        style: r.style,
        scoreA: Number(r.score_a ?? 0),
        scoreB: Number(r.score_b ?? 0),
        scoreC: Number(r.score_c ?? 0),
        deductions: Number(r.deductions ?? 0),
        finalScore: Number(r.final_score ?? 0),
        dns: (r.payload?.status ?? "").toUpperCase() === "DNS",
      }));

      const filtered = styleFilter ? built.filter((b) => !b.style || b.style === styleFilter) : built;
      setRows(rankRows(filtered));
    } finally {
      setLoading(false);
    }
  }, [sessionCode, styleFilter]);

  useEffect(() => { if (open) void load(); }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const arena = displayMode === "arena";

  return (
    <div className={`fixed inset-0 z-[120] flex items-center justify-center ${arena ? "p-0 animate-in fade-in duration-300" : "p-4"}`} style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)" }}>
      <div className={`${arena ? "h-screen max-h-screen rounded-none border-x-0 animate-in slide-in-from-bottom-4 duration-300" : "max-h-[88vh] rounded-2xl"} w-full max-w-7xl flex flex-col border border-white/10 bg-black/80 overflow-hidden`}>
        <header className={`flex items-center justify-between gap-3 border-b border-white/10 shrink-0 ${arena ? "px-8 py-6" : "px-4 py-3"}`}>
          <div className="flex items-center gap-2 min-w-0">
            <Trophy className={arena ? "h-8 w-8" : "h-4 w-4"} style={{ color: "#FACC15" }} />
            <div className="min-w-0">
              <p className={`${arena ? "text-2xl md:text-4xl" : "text-sm"} font-heading font-black text-white truncate`}>
                {eventTitle ?? "الترتيب العام · STANDINGS"}
              </p>
              <p className={`${arena ? "text-sm md:text-lg mt-1" : "text-[10px]"} font-bold text-white/45 truncate`}>
                {categoryTitle || (styleFilter ? styleLabelAr(styleFilter) : "كل الأساليب")} · {rows.length} نتيجة منشورة
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => window.print()} className="h-8 px-3 rounded-lg border border-white/10 bg-white/5 text-[11px] font-bold text-white/70 hover:text-white flex items-center gap-1">
              <Printer className="h-3 w-3" /> طباعة / Print
            </button>
            <button onClick={() => void load()} className="h-8 px-3 rounded-lg border border-white/10 bg-white/5 text-[11px] font-bold text-white/70 hover:text-white flex items-center gap-1">
              <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> تحديث
            </button>
            <button onClick={onClose} className="h-8 w-8 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center text-white/70 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {rows.length === 0 ? (
            <p className="py-14 text-center text-[13px] text-white/40" dir="rtl">
              {loading ? "جارٍ التحميل…" : "لا توجد نتائج منشورة بعد"}
            </p>
          ) : (
            <table className="w-full text-white border-collapse">
              <thead className="sticky top-0 bg-black/90 backdrop-blur">
                <tr className={`${arena ? "text-sm" : "text-[9px]"} uppercase tracking-[0.2em] text-white/40`} dir="ltr">
                  <th className="p-2 text-left w-16">Rank</th>
                  <th className="p-2 text-left">Country / Club</th>
                  <th className="p-2 text-left">Athlete</th>
                  {!arena && <th className="p-2 text-right w-16">A</th>}
                  {!arena && <th className="p-2 text-right w-16">B</th>}
                  {!arena && <th className="p-2 text-right w-16">C</th>}
                  {!arena && <th className="p-2 text-right w-20">Ded.</th>}
                  <th className="p-2 text-right w-24">Final</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.athleteId} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <td className="p-2">
                      <span
                        className="inline-flex h-7 min-w-7 px-1.5 items-center justify-center rounded-full text-[11px] font-black tabular-nums"
                        style={i < 3
                          ? { background: `${MEDAL[i]}22`, border: `1px solid ${MEDAL[i]}88`, color: MEDAL[i] }
                          : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)" }}
                        dir="ltr"
                      >
                        {r.dns ? "DNS" : i + 1}
                      </span>
                    </td>
                    <td className={`${arena ? "p-4 text-xl" : "p-2 text-base"} text-white/60 truncate max-w-[280px]`} dir="ltr">
                      {arena
                        ? [countryFlag(r.country), countryCode(r.country), r.club].filter(Boolean).join("  ·  ") || "—"
                        : affiliationLabel(r.club, r.country) || "—"}
                    </td>
                    <td className={`${arena ? "p-4 text-2xl md:text-3xl" : "p-2 text-xl"} font-heading font-black truncate max-w-[420px]`}>{r.name}</td>
                    {!arena && <td className="p-2 text-right text-lg tabular-nums text-white/70" dir="ltr">{r.scoreA.toFixed(3)}</td>}
                    {!arena && <td className="p-2 text-right text-lg tabular-nums text-white/70" dir="ltr">{r.scoreB.toFixed(3)}</td>}
                    {!arena && <td className="p-2 text-right text-lg tabular-nums text-white/70" dir="ltr">{r.scoreC.toFixed(3)}</td>}
                    {!arena && <td className="p-2 text-right text-lg tabular-nums text-red-300/80" dir="ltr">−{r.deductions.toFixed(3)}</td>}
                    <td className={`${arena ? "p-4 text-4xl" : "p-2 text-2xl"} text-right font-black tabular-nums`} style={{ color: r.dns ? "rgba(255,255,255,0.45)" : "#FACC15" }} dir="ltr">
                      {r.dns ? "DNS" : r.finalScore.toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
