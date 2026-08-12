import { useState, useRef, useEffect } from "react";
import { useCompetition } from "@/store/competition-store";
import { supabase } from "@/integrations/supabase/client";
import { Send, Bot, X, Trash2, Loader2, Sparkles } from "lucide-react";

// Build a snapshot of the live match for the AI from the store + DB
async function buildMatchContext(opts: {
  sessionCode: string | null;
  athleteId: string | null;
  athleteName: string | null;
  athleteCountry: string | null;
  athleteCategory: string | null;
  style: string | null;
  performanceTimeSec: number;
}) {
  const { sessionCode, athleteId } = opts;
  if (!sessionCode || !athleteId) {
    return {
      athleteName: opts.athleteName,
      country: opts.athleteCountry,
      category: opts.athleteCategory,
      style: opts.style,
      performanceTimeSec: opts.performanceTimeSec,
    };
  }

  // Pull enriched athlete row + judge scores + latest result in parallel
  const [aRes, jsRes, mrRes] = await Promise.all([
    supabase.from("athletes").select("club, bib_number, difficulty_codes").eq("id", athleteId).maybeSingle(),
    supabase.from("judge_scores").select("judge_slot, judge_role, score, payload").eq("session_code", sessionCode).eq("athlete_id", athleteId),
    supabase.from("match_results").select("final_score, score_a, score_b, score_c, deductions, payload").eq("session_code", sessionCode).eq("athlete_id", athleteId).order("updated_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const a = aRes.data as { club: string | null; bib_number: string | null; difficulty_codes: string[] | null } | null;
  const scores = (jsRes.data ?? []) as { judge_slot: string; judge_role: string; score: number | null; payload: any }[];
  const result = mrRes.data as { final_score: number | null; score_a: number | null; score_b: number | null; score_c: number | null; deductions: number | null; payload: any } | null;

  // Confirmed Group A deductions (≥2 judges)
  const codeCounter = new Map<string, Set<string>>();
  scores.filter(s => s.judge_role === "A" || s.judge_slot.startsWith("A")).forEach(s => {
    const codes: string[] = Array.isArray(s.payload?.codes) ? s.payload.codes : [];
    codes.forEach(c => {
      if (!codeCounter.has(c)) codeCounter.set(c, new Set());
      codeCounter.get(c)!.add(s.judge_slot);
    });
  });
  const confirmedDeductions: { code: string; count: number }[] = [];
  codeCounter.forEach((slots, code) => { if (slots.size >= 2) confirmedDeductions.push({ code, count: slots.size }); });

  // Group B individual scores with kept/dropped role
  const bRaw = scores
    .filter(s => (s.judge_role === "B" || s.judge_slot.startsWith("B")) && typeof s.score === "number")
    .map(s => ({ slot: s.judge_slot, score: Number(s.score) }))
    .sort((x, y) => x.slot.localeCompare(y.slot));
  let bIndividualScores: { slot: string; score: number; role: string }[] = [];
  if (bRaw.length >= 3) {
    const maxV = Math.max(...bRaw.map(b => b.score));
    const minV = Math.min(...bRaw.map(b => b.score));
    let highTaken = false, lowTaken = false;
    bIndividualScores = bRaw.map(b => {
      if (!highTaken && b.score === maxV) { highTaken = true; return { ...b, role: "high(dropped)" }; }
      if (!lowTaken && b.score === minV) { lowTaken = true; return { ...b, role: "low(dropped)" }; }
      return { ...b, role: "kept" };
    });
  } else {
    bIndividualScores = bRaw.map(b => ({ ...b, role: "single" }));
  }

  // Group C attempt aggregation per declared code
  const codes = a?.difficulty_codes ?? [];
  const successCount = new Map<string, number>();
  const totalCount = new Map<string, number>();
  scores.filter(s => s.judge_role === "C" || s.judge_slot.startsWith("C")).forEach(s => {
    const attempts = Array.isArray(s.payload?.attempts) ? s.payload.attempts : [];
    attempts.forEach((at: any) => {
      if (!at?.code) return;
      totalCount.set(at.code, (totalCount.get(at.code) ?? 0) + 1);
      if (at.successful) successCount.set(at.code, (successCount.get(at.code) ?? 0) + 1);
    });
  });
  const difficultyAttempts = codes.map(code => {
    const t = totalCount.get(code) ?? 0;
    const s = successCount.get(code) ?? 0;
    return { code, success: t > 0 ? s >= Math.ceil(t / 2) : null };
  });

  return {
    athleteName: opts.athleteName,
    bib: a?.bib_number ?? null,
    country: opts.athleteCountry,
    club: a?.club ?? null,
    category: opts.athleteCategory,
    style: opts.style,
    performanceTimeSec: opts.performanceTimeSec,
    finalScore: result?.final_score ?? null,
    groupA: result?.score_a ?? null,
    groupB: result?.score_b ?? null,
    groupC: result?.score_c ?? null,
    taDeductions: result?.deductions ?? null,
    confirmedDeductions,
    bIndividualScores,
    difficultyAttempts,
  };
}

export function AiAssistantSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    aiMessages, addAiMessage, clearAiMessages,
    competitionStyle, sessionCode, athletes, currentAthleteIndex, timerElapsed,
  } = useCompetition();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [aiMessages]);

  const send = async () => {
    if (!input.trim() || busy) return;
    const q = input.trim();
    setInput("");
    addAiMessage({ role: "user", content: q });
    setBusy(true);

    try {
      const athlete = athletes[currentAthleteIndex];
      const context = await buildMatchContext({
        sessionCode,
        athleteId: athlete?.id ?? null,
        athleteName: athlete?.name ?? null,
        athleteCountry: athlete?.country ?? null,
        athleteCategory: athlete?.category ?? null,
        style: competitionStyle,
        performanceTimeSec: timerElapsed,
      });

      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        addAiMessage({ role: "assistant", content: "⚠️ الجلسة غير مصادقة — أعد الدخول إلى الجلسة" });
        return;
      }
      const r = await fetch(`${SUPABASE_URL}/functions/v1/taolu-coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          question: q,
          sessionCode,
          context,
          history: aiMessages.slice(-6),
        }),
      });


      const data = await r.json();
      if (!r.ok) {
        addAiMessage({ role: "assistant", content: `⚠️ ${data.error ?? "AI request failed"}` });
      } else {
        addAiMessage({ role: "assistant", content: data.reply ?? "(empty reply)" });
      }
    } catch (e) {
      addAiMessage({ role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : "Network error"}` });
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  const activeAthlete = athletes[currentAthleteIndex];

  return (
    <div className="fixed inset-y-0 left-0 w-80 md:w-96 bg-card border-l border-border z-50 flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles className="h-5 w-5 text-fed-blue shrink-0" />
          <div className="min-w-0">
            <h3 className="font-heading font-bold text-foreground text-sm truncate">المساعد الذكي · AI Coach</h3>
            {activeAthlete && (
              <p className="text-[10px] text-muted-foreground font-body truncate" dir="ltr">
                Live: {activeAthlete.name}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={clearAiMessages} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={onClose} className="h-7 w-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {aiMessages.length === 0 && (
          <div className="text-center text-muted-foreground font-body text-sm py-8">
            <Bot className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>اسأل عن النتيجة الحالية، الخصومات، أو قواعد IWUF</p>
            <p className="text-xs mt-1" dir="ltr">Ask about live scores, deductions, IWUF rules</p>
          </div>
        )}
        {aiMessages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm font-body whitespace-pre-wrap ${
              msg.role === "user"
                ? "bg-fed-blue/20 text-foreground border border-fed-blue/20"
                : "bg-navy-light text-foreground border border-border"
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-xl px-3 py-2 text-sm bg-navy-light border border-border flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> يفكر...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder="اسأل عن المباراة..."
            disabled={busy}
            className="flex-1 h-9 rounded-lg bg-navy-light border border-border px-3 text-sm font-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-fed-blue disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            className="h-9 w-9 rounded-lg bg-fed-blue flex items-center justify-center text-fed-blue-foreground hover:bg-fed-blue/80 active:scale-95 transition-all disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
