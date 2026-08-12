// Edge function: Taolu Coach — AI assistant with live match context.
// Uses Lovable AI Gateway (no API key required).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface MatchContext {
  athleteName?: string | null;
  bib?: string | null;
  country?: string | null;
  club?: string | null;
  category?: string | null;
  style?: string | null;
  finalScore?: number | null;
  groupA?: number | null;
  groupB?: number | null;
  groupC?: number | null;
  taDeductions?: number | null;
  performanceTimeSec?: number | null;
  confirmedDeductions?: { code: string; count: number }[];
  bIndividualScores?: { slot: string; score: number; role: string }[];
  difficultyAttempts?: { code: string; success: boolean | null }[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // --- Authentication: require a valid Supabase user session -------------
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnonKey },
    });
    if (!userRes.ok) return json({ error: "Unauthorized" }, 401);
    const user = await userRes.json();
    if (!user?.id) return json({ error: "Unauthorized" }, 401);

    const { question, context, history, sessionCode } = await req.json() as {
      question: string;
      context?: MatchContext;
      history?: { role: "user" | "assistant"; content: string }[];
      sessionCode?: string | null;
    };

    // --- Authorization: caller must be a member of an active session --------
    if (!sessionCode || typeof sessionCode !== "string" || sessionCode.length > 32) {
      return json({ error: "Forbidden: missing session" }, 403);
    }
    const memberRes = await fetch(
      `${supabaseUrl}/rest/v1/session_members?select=session_code&session_code=eq.${encodeURIComponent(sessionCode)}`,
      { headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnonKey } },
    );
    const memberRows = memberRes.ok ? await memberRes.json() : [];
    if (!Array.isArray(memberRows) || memberRows.length === 0) {
      return json({ error: "Forbidden: not a session member" }, 403);
    }
    const sessRes = await fetch(
      `${supabaseUrl}/rest/v1/sessions?select=code&active=eq.true&code=eq.${encodeURIComponent(sessionCode)}`,
      { headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnonKey } },
    );
    const sessRows = sessRes.ok ? await sessRes.json() : [];
    if (!Array.isArray(sessRows) || sessRows.length === 0) {
      return json({ error: "Forbidden: session not active" }, 403);
    }

    // --- Input validation ---------------------------------------------------
    if (typeof question !== "string" || question.trim().length === 0 || question.length > 2000) {
      return json({ error: "Invalid question" }, 400);
    }
    const safeHistory = (Array.isArray(history) ? history : [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));


    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ctxLines: string[] = [];
    if (context?.athleteName) {
      ctxLines.push(`Athlete: ${context.athleteName}${context.bib ? ` (BIB #${context.bib})` : ""}`);
      if (context.country || context.club) ctxLines.push(`From: ${[context.country, context.club].filter(Boolean).join(" · ")}`);
      if (context.category) ctxLines.push(`Category: ${context.category}`);
      if (context.style) ctxLines.push(`Style: ${context.style}`);
      if (typeof context.performanceTimeSec === "number") ctxLines.push(`Performance time: ${context.performanceTimeSec.toFixed(1)}s`);
      if (typeof context.finalScore === "number") ctxLines.push(`Final score: ${context.finalScore.toFixed(2)}`);
      if (typeof context.groupA === "number") ctxLines.push(`Group A (Quality): ${context.groupA.toFixed(2)} / 5.00`);
      if (typeof context.groupB === "number") ctxLines.push(`Group B (Performance avg): ${context.groupB.toFixed(2)} / 3.00`);
      if (typeof context.groupC === "number") ctxLines.push(`Group C (Difficulty): ${context.groupC.toFixed(2)} / 2.00`);
      if (typeof context.taDeductions === "number" && context.taDeductions > 0) ctxLines.push(`Technical Assistant deductions: -${context.taDeductions.toFixed(2)}`);
      if (context.confirmedDeductions?.length) {
        ctxLines.push(`Confirmed Group A deductions: ${context.confirmedDeductions.map(d => `${d.code} ×${d.count}`).join(", ")}`);
      }
      if (context.bIndividualScores?.length) {
        ctxLines.push(`Group B raw scores: ${context.bIndividualScores.map(b => `${b.slot}=${b.score.toFixed(2)}(${b.role})`).join(", ")}`);
      }
      if (context.difficultyAttempts?.length) {
        const ok = context.difficultyAttempts.filter(a => a.success === true).length;
        const fail = context.difficultyAttempts.filter(a => a.success === false).length;
        ctxLines.push(`Group C movements: ${ok} successful, ${fail} failed of ${context.difficultyAttempts.length}`);
      }
    } else {
      ctxLines.push("No active athlete data yet.");
    }

    const systemPrompt = `You are the AI judging coach for the Tunisian Wushu Federation Taolu platform. Apply the IWUF 2024 rulebook strictly.

Group A (Quality, max 5.00): deductions of 0.10 (minor), 0.20 (medium), 0.30 (major), 1.00 (fall). 5+ A judges; codes confirmed by ≥2 judges count.
Group B (Performance, max 3.00): drop highest + lowest of 5 raw scores, average the middle three.
Group C (Difficulty, max 2.00): only successful attempts count; values come from the athlete's pre-declared difficulty sheet.
Final = A + B(avg) + C − Technical Assistant deductions.

LIVE MATCH CONTEXT
------------------
${ctxLines.join("\n")}

Answer in the SAME language the user wrote (Arabic or English). Be concise, cite specific numbers from the context above whenever relevant, and reference IWUF rules when explaining deductions or thresholds. If the user asks about an athlete and there is no active match data, say so plainly.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...safeHistory,
      { role: "user", content: question },
    ];

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
    });

    if (r.status === 429) return json({ error: "Rate limit reached. Try again in a moment." }, 429);
    if (r.status === 402) return json({ error: "AI credits exhausted. Add funds in Lovable workspace." }, 402);
    if (!r.ok) {
      console.error("AI gateway error", r.status, await r.text());
      return json({ error: "AI request failed" }, 500);
    }

    const data = await r.json();
    const reply = data.choices?.[0]?.message?.content ?? "(no reply)";
    return json({ reply });
  } catch (err) {
    console.error("taolu-coach error", err);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

