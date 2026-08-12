import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldAlert, Flag, RefreshCw, Activity, ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

interface ScoreRow {
  id: string;
  judge_slot: string;
  judge_role: string;
  score: number | null;
  submitted: boolean;
  athlete_id: string | null;
  payload: Record<string, unknown> | null;
  updated_at?: string;
}

interface CurrentMatchRow {
  athlete_id: string | null;
  style: string | null;
  payload: Record<string, unknown> | null;
}

export function VarReviewDashboard() {
  const [sessionCode, setSessionCode] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("var_session") ?? "";
  });
  const [codeInput, setCodeInput] = useState(sessionCode);
  const [match, setMatch] = useState<CurrentMatchRow | null>(null);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [varRequest, setVarRequest] = useState<{ at: number; athlete_name: string | null; bib: string | null } | null>(null);

  useEffect(() => {
    if (!sessionCode) return;
    let cancelled = false;

    const loadMatch = async () => {
      const { data } = await supabase
        .from("current_match")
        .select("athlete_id, style, payload")
        .eq("session_code", sessionCode)
        .maybeSingle();
      if (!cancelled) setMatch((data as CurrentMatchRow | null) ?? null);
    };

    const loadScores = async () => {
      const { data } = await supabase
        .from("judge_scores")
        .select("id, judge_slot, judge_role, score, submitted, athlete_id, payload, updated_at")
        .eq("session_code", sessionCode)
        .order("judge_slot", { ascending: true });
      if (!cancelled) setScores((data ?? []) as ScoreRow[]);
    };

    void loadMatch();
    void loadScores();

    const ch = supabase
      .channel(`var-${sessionCode}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "judge_scores", filter: `session_code=eq.${sessionCode}` },
        () => void loadScores())
      .on("postgres_changes",
        { event: "*", schema: "public", table: "current_match", filter: `session_code=eq.${sessionCode}` },
        () => void loadMatch())
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "match_events", filter: `session_code=eq.${sessionCode}` },
        (p) => {
          const row = p.new as { event_type?: string; payload?: Record<string, unknown> };
          if (row?.event_type !== "var_review_request") return;
          const pl = row.payload ?? {};
          setVarRequest({
            at: Number(pl['at'] ?? 0),
            athlete_name: (pl['athlete_name'] as string | null) ?? null,
            bib: (pl['bib'] as string | null) ?? null,
          });
          toast.warning(`طلب مراجعة فيديو — ${(pl['athlete_name'] as string) ?? "اللاعب الحالي"}`);
        })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [sessionCode]);

  const athleteName = (match?.payload as { athlete?: { name?: string } } | null)?.athlete?.name ?? "—";
  const athleteId = match?.athlete_id ?? null;

  const currentScores = useMemo(
    () => scores.filter(s => !athleteId || s.athlete_id === athleteId),
    [scores, athleteId],
  );

  const toggleFlag = async (s: ScoreRow) => {
    const next = new Set(flagged);
    const isFlagging = !next.has(s.id);
    if (isFlagging) next.add(s.id); else next.delete(s.id);
    setFlagged(next);
    // Broadcast a match_event so Chief sees the flag in real time
    await supabase.from("match_events").insert({
      session_code: sessionCode,
      event_type: isFlagging ? "var_flag" : "var_unflag",
      payload: { judge_slot: s.judge_slot, score: s.score, score_id: s.id },
    });
    toast.success(isFlagging ? `Flagged ${s.judge_slot} for review` : `Cleared flag on ${s.judge_slot}`);
  };

  if (!sessionCode) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#050505] text-white">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="h-5 w-5 text-orange-400" />
            <h1 className="text-lg font-heading font-black tracking-wider">VAR REVIEW</h1>
          </div>
          <p className="text-sm text-white/60 mb-4">Enter the active session code to monitor judging in real time.</p>
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            placeholder="ABC123"
            className="w-full h-11 rounded-lg bg-black/40 border border-white/10 px-3 font-mono text-center text-xl tracking-widest text-white"
            maxLength={8}
          />
          <button
            onClick={() => {
              if (codeInput.trim().length < 4) return;
              localStorage.setItem("var_session", codeInput.trim());
              setSessionCode(codeInput.trim());
            }}
            className="mt-3 w-full h-10 rounded-lg bg-orange-500 hover:bg-orange-600 font-heading font-black tracking-widest text-sm text-black"
          >
            CONNECT
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white" style={{ background: "#050505" }}>
      <header className="h-14 border-b border-white/10 bg-white/[0.02] backdrop-blur-xl px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="h-8 w-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <ShieldAlert className="h-5 w-5 text-orange-400" />
          <div className="leading-tight">
            <p className="text-[9px] uppercase tracking-[0.3em] text-white/40">Video Assistant Referee</p>
            <h1 className="text-sm font-heading font-black tracking-widest text-white">VAR REVIEW</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-white/40 font-mono">SESSION {sessionCode}</span>
          <button
            onClick={() => { localStorage.removeItem("var_session"); setSessionCode(""); }}
            className="text-[10px] text-white/40 hover:text-white"
          >
            Disconnect
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 space-y-4">
        {varRequest && (
          <section className="rounded-2xl border border-orange-500/50 bg-orange-500/10 p-4 flex items-center justify-between animate-pulse">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-orange-300">VAR Review Requested</p>
              <p className="text-lg font-heading font-black text-white mt-1" dir="ltr">
                {varRequest.bib ? `#${varRequest.bib} · ` : ""}{varRequest.athlete_name ?? athleteName}
              </p>
              <p className="text-[11px] text-white/60 font-mono" dir="ltr">
                @ {Math.floor(varRequest.at / 60)}:{String(varRequest.at % 60).padStart(2, "0")}
              </p>
            </div>
            <button onClick={() => setVarRequest(null)}
              className="h-8 px-3 rounded-lg bg-orange-500 text-black text-[11px] font-black tracking-wider">
              ACKNOWLEDGE
            </button>
          </section>
        )}

        {/* Current athlete card */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">Current Athlete</p>
            <p className="text-xl font-heading font-black text-white mt-1">{athleteName}</p>
            <p className="text-[10px] text-white/40 mt-0.5" dir="ltr">
              Style: {match?.style ?? "—"} · {currentScores.length} score(s) submitted
            </p>
          </div>
          <Activity className="h-6 w-6 text-emerald-400 animate-pulse" />
        </section>

        {/* Score log */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
          <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-[11px] font-heading font-black tracking-[0.25em] text-white/70">SCORE LOG</h2>
            <span className="text-[10px] text-white/40">Live • Postgres realtime</span>
          </div>
          {currentScores.length === 0 ? (
            <div className="p-8 text-center text-sm text-white/40">No scores submitted yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-[10px] uppercase tracking-wider text-white/50">
                <tr>
                  <th className="text-left px-4 py-2">Slot</th>
                  <th className="text-left px-4 py-2">Group</th>
                  <th className="text-right px-4 py-2">Score</th>
                  <th className="text-left px-4 py-2">Submitted</th>
                  <th className="text-right px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {currentScores.map((s) => {
                  const isFlagged = flagged.has(s.id);
                  return (
                    <tr key={s.id} className={`border-t border-white/5 ${isFlagged ? "bg-orange-500/10" : ""}`}>
                      <td className="px-4 py-2 font-heading font-black text-white" dir="ltr">{s.judge_slot}</td>
                      <td className="px-4 py-2 text-white/60" dir="ltr">{s.judge_role}</td>
                      <td className="px-4 py-2 text-right font-mono tabular-nums text-white" dir="ltr">
                        {typeof s.score === "number" ? s.score.toFixed(2) : "—"}
                      </td>
                      <td className="px-4 py-2 text-[10px] text-white/40" dir="ltr">
                        {s.submitted ? "✓" : "draft"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => toggleFlag(s)}
                          className={`inline-flex items-center gap-1 h-7 px-2 rounded-lg text-[10px] font-heading font-bold tracking-wider transition-all ${
                            isFlagged
                              ? "bg-orange-500 text-black hover:bg-orange-400"
                              : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
                          }`}
                        >
                          <Flag className="h-3 w-3" />
                          {isFlagged ? "FLAGGED" : "FLAG"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <p className="text-[10px] text-white/30 text-center">
          Flagging a score broadcasts a <code className="text-white/50">var_flag</code> event to the Chief Dashboard for re-evaluation.
        </p>
      </main>
    </div>
  );
}
