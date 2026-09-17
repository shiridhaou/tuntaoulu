import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { countryFlag } from "@/lib/affiliation";
import { Trophy } from "lucide-react";

/**
 * READ-ONLY post-group podium overlay (public display).
 * Renders the TOP 4 athletes from published `match_results` for the session.
 * It never writes, resets or touches live scoring / Judge C progression.
 */

interface PodiumRow {
  athleteId: string;
  name: string;
  club: string | null;
  country: string | null;
  scoreA: number;
  scoreB: number;
  scoreC: number;
  finalScore: number;
}

const MEDAL = ["#FACC15", "#CBD5E1", "#D97706", "rgba(255,255,255,0.55)"];

export function PodiumOverlay({
  sessionCode,
  open,
  styleFilter,
}: {
  sessionCode: string | null;
  open: boolean;
  styleFilter?: string | null;
}) {
  const [rows, setRows] = useState<PodiumRow[]>([]);
  const [shown, setShown] = useState(false);

  const load = useCallback(async () => {
    const code = (sessionCode ?? "").trim().toUpperCase();
    if (!code) { setRows([]); return; }
    const { data } = await supabase
      .from("match_results")
      .select("athlete_id, athlete_name, style, score_a, score_b, score_c, final_score, updated_at")
      .eq("session_code", code)
      .eq("published", true)
      .order("updated_at", { ascending: false });

    const results = (data ?? []) as Array<{
      athlete_id: string; athlete_name: string | null; style: string | null;
      score_a: number | null; score_b: number | null; score_c: number | null; final_score: number;
    }>;

    const latest = new Map<string, typeof results[number]>();
    for (const r of results) if (!latest.has(r.athlete_id)) latest.set(r.athlete_id, r);

    const ids = [...latest.keys()];
    const meta = new Map<string, { full_name: string; club: string | null; country: string | null }>();
    if (ids.length) {
      const { data: ath } = await supabase
        .from("athletes").select("id, full_name, club, country").in("id", ids);
      for (const a of (ath ?? []) as Array<{ id: string; full_name: string; club: string | null; country: string | null }>) {
        meta.set(a.id, { full_name: a.full_name, club: a.club, country: a.country });
      }
    }

    const built = [...latest.values()]
      .filter((r) => !styleFilter || !r.style || r.style === styleFilter)
      .map((r) => ({
        athleteId: r.athlete_id,
        name: meta.get(r.athlete_id)?.full_name ?? r.athlete_name ?? "—",
        club: meta.get(r.athlete_id)?.club ?? null,
        country: meta.get(r.athlete_id)?.country ?? null,
        scoreA: Number(r.score_a ?? 0),
        scoreB: Number(r.score_b ?? 0),
        scoreC: Number(r.score_c ?? 0),
        finalScore: Number(r.final_score ?? 0),
      }))
      .sort((x, y) =>
        y.finalScore - x.finalScore ||
        y.scoreC - x.scoreC ||
        y.scoreB - x.scoreB ||
        y.scoreA - x.scoreA ||
        x.name.localeCompare(y.name),
      )
      .slice(0, 4);

    setRows(built);
  }, [sessionCode, styleFilter]);

  useEffect(() => {
    if (!open) { setShown(false); return; }
    void load();
    const t = window.setTimeout(() => setShown(true), 40);
    return () => window.clearTimeout(t);
  }, [open, load]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-6 transition-opacity duration-500"
      style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(14px)", opacity: shown ? 1 : 0 }}
    >
      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-center gap-3 mb-8">
          <Trophy className="h-7 w-7" style={{ color: "#FACC15" }} />
          <div className="text-center">
            <p className="text-2xl md:text-3xl font-heading font-black" style={{ color: "#FACC15" }}>
              النتائج النهائية · TOP 4
            </p>
            <p className="text-[11px] font-bold tracking-[0.35em] text-white/45" dir="ltr">
              GROUP COMPLETED · OFFICIAL PLACING
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="text-center text-white/40 text-sm" dir="rtl">لا توجد نتائج منشورة بعد</p>
        ) : (
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div
                key={r.athleteId}
                className="flex items-center gap-4 rounded-2xl border px-5 py-4 transition-all duration-700"
                style={{
                  borderColor: `${MEDAL[i]}66`,
                  background: `${MEDAL[i]}12`,
                  transform: shown ? "translateY(0)" : "translateY(24px)",
                  opacity: shown ? 1 : 0,
                  transitionDelay: `${i * 140}ms`,
                }}
              >
                <span
                  className="h-12 w-12 shrink-0 rounded-full flex items-center justify-center text-2xl font-heading font-black tabular-nums"
                  style={{ background: `${MEDAL[i]}22`, border: `2px solid ${MEDAL[i]}`, color: MEDAL[i] }}
                  dir="ltr"
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xl md:text-2xl font-heading font-black text-white">{r.name}</p>
                  <p className="truncate text-[12px] font-bold text-white/55" dir="ltr">
                    {[r.country ? `${countryFlag(r.country) ? `${countryFlag(r.country)} ` : ""}${r.country}` : "", r.club]
                      .filter(Boolean).join("  ·  ") || "—"}
                  </p>
                </div>
                <span
                  className="text-3xl md:text-4xl font-heading font-black tabular-nums shrink-0"
                  style={{ color: MEDAL[i] }}
                  dir="ltr"
                >
                  {r.finalScore.toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
