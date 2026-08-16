import { useState, useMemo, useCallback, useEffect, useRef, type ReactNode } from "react";
import {
  CompetitionContext, STYLE_CONFIGS, DEFAULT_TEAM,
  type CompetitionStyle, type UserRole, type Athlete, type AppliedDeduction,
  type DifficultyAttempt, type MovementSequenceItem, type JoinRequest, type AthleteReport,
  type TeamConfig, type JudgeAssignments, type RequestedRole,
} from "@/store/competition-store";
import { supabase } from "@/integrations/supabase/client";
import { matchControl, useMatchSync } from "@/hooks/useMatchSync";
import { useTeamSync, pushTeamConfig } from "@/hooks/useTeamSync";
import { modeCaps, MAX_JUDGE_SLOTS, type MatchMode } from "@/lib/matchMode";
import { joinSessionMembership } from "@/lib/sessionMembership";

const MAX_B = MAX_JUDGE_SLOTS;

const DEFAULT_MOVEMENTS: MovementSequenceItem[] = [
  { id: "m1", name: "Front Sweep", nameAr: "كنس أمامي", status: "pending" },
  { id: "m2", name: "Tornado Kick", nameAr: "ركلة دوّارة", status: "pending" },
  { id: "m3", name: "Butterfly Kick", nameAr: "ركلة الفراشة", status: "pending" },
  { id: "m4", name: "Aerial Cartwheel", nameAr: "عجلة هوائية", status: "pending" },
  { id: "m5", name: "Jump Inside Kick", nameAr: "ركلة قفز داخلية", status: "pending" },
  { id: "m6", name: "Lotus Kick", nameAr: "ركلة اللوتس", status: "pending" },
  { id: "m7", name: "Back Sweep", nameAr: "كنس خلفي", status: "pending" },
  { id: "m8", name: "Split Leap", nameAr: "قفزة انشقاقية", status: "pending" },
];

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// SSR-safe localStorage helpers — persist auth/role/session so reloads or tab opens
// (e.g. CAST window) don't bounce the user back to PIN entry.
const LS_KEYS = {
  auth: "taolu.isAuthenticated",
  role: "taolu.selectedRole",
  session: "taolu.sessionCode",
  judgeId: "taolu.judgeId",
} as const;

function lsGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch { /* ignore */ }
}

async function ensureDeviceSession(): Promise<void> {
  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (data.session) return;

  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}

export function CompetitionProvider({ children }: { children: ReactNode }) {
  const [storageHydrated, setStorageHydrated] = useState(false);
  const [isAuthenticated, setAuthenticated] = useState<boolean>(false);
  const [selectedRole, setSelectedRole] = useState<UserRole>(null);
  const [competitionStyle, setCompetitionStyle] = useState<CompetitionStyle>(null);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [currentAthleteIndex, setCurrentAthleteIndex] = useState(0);
  const [judgeADeductions, setJudgeADeductions] = useState<AppliedDeduction[]>([]);
  const [judgeBScores, setJudgeBScores] = useState<number[]>(Array(MAX_B).fill(3.0));
  const [judgeCAttempts, setJudgeCAttempts] = useState<DifficultyAttempt[]>([]);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [continuityPause, setContinuityPause] = useState(0);
  const [aiMessages, setAiMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [sessionCode, setSessionCodeState] = useState<string | null>(null);
  const [judgeId, setJudgeIdState] = useState<string | null>(null);
  const [setupComplete, setSetupCompleteState] = useState<boolean>(false);
  const setSetupComplete = useCallback((v: boolean) => {
    setSetupCompleteState(v);
    lsSet("taolu.setupComplete", v ? "1" : null);
  }, []);
  const [team, setTeamConfig] = useState<TeamConfig>(DEFAULT_TEAM);
  const [movementSequence, setMovementSequence] = useState<MovementSequenceItem[]>(DEFAULT_MOVEMENTS);
  const [scoreRevealed, setScoreRevealed] = useState(false);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [judgeAssignments, setJudgeAssignments] = useState<JudgeAssignments>({});
  const [judgeOverrides, setJudgeOverrides] = useState<Record<string, number | null>>({});
  const [marqueeText, setMarqueeText] = useState<string>(
    "الجامعة التونسية للووشو كونغ فو — Tunisian Wushu Kung Fu Federation — البطولة الوطنية 2024 — National Championship 2024"
  );
  const [sponsorLogos, setSponsorLogos] = useState<string[]>([]);
  const [leaderboardMode, setLeaderboardMode] = useState(false);
  const [results, setResults] = useState<Record<string, number>>({});
  const [reports, setReports] = useState<Record<string, AthleteReport>>({});
  const [deductionTimes, setDeductionTimes] = useState<number[]>([]);
  const [styleMode, setStyleMode] = useState<"mandatory" | "optional">("mandatory");
  const [suggestedDeductions, setSuggestedDeductions] = useState<{ code: string; label: string; value: number; reason: string; createdAt: number }[]>([]);
  const [ahjReady, setAhjReady] = useState(false);
  const [isVarLiveOnPublic, setIsVarLiveOnPublicState] = useState(false);

  const config = competitionStyle ? STYLE_CONFIGS[competitionStyle] : STYLE_CONFIGS.changquan;

  // Live match mode (compulsory | optional) — single source of truth is current_match.payload.match_mode.
  // The TA pushes it whenever it changes; everyone (Chief, Judges B/C, Public) reflects it instantly.
  //
  // OFFICIAL CAPS (total 10.00 in both modes):
  //   compulsory → A 7.00 · B 3.00 · C disabled
  //   optional   → A 5.00 · B 3.00 · C 2.00 (1.40 movement + 0.60 connection)
  const matchSync = useMatchSync(sessionCode);
  const liveMatchMode: MatchMode = ((matchSync.payload as Record<string, unknown> | null)?.match_mode as MatchMode | undefined) ?? "optional";
  const caps = modeCaps(liveMatchMode);
  const effMaxA = caps.maxA;
  const effMaxB = caps.maxB;
  const includeC = caps.includeC;

  // ACCESS (v3.0): NO email/password login. Officials enter with the session code
  // + a role pick (and soon an NFC card). A silent anonymous device session is
  // created in the background so that RLS ("must be signed in to write") still
  // holds — the operator never sees a login screen.
  useEffect(() => {
    let cancelled = false;
    const ensure = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) { setAuthenticated(true); return; }
      const { error } = await supabase.auth.signInAnonymously();
      if (cancelled) return;
      if (error) {
        console.error("[access] anonymous device session failed:", error.message);
        setAuthenticated(true); // never block the operator UI
      }
    };
    void ensure();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setAuthenticated(true);
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    // SESSION + ROLE PERSISTENCE: the assigned station (role + session code + slot)
    // is restored from localStorage on EVERY load — reload, new tab, or a websocket
    // reconnect that remounts the tree. This is what keeps a judge locked on their
    // own screen instead of falling back to the default/VAR view.
    // Only an explicit "خروج" (logout) clears the stored role.
    try {
      if (typeof window !== "undefined") window.sessionStorage.setItem("taolu.tab", "1");
    } catch { /* ignore */ }

    // STALE STATE GUARD: older builds stored fabricated ids prefixed with
    // "local-". Those are invalid UUIDs and poison every DB write, so wipe the
    // whole persisted namespace and start from Role Selection.
    try {
      if (typeof window !== "undefined") {
        const poisoned: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (!k || !k.startsWith("taolu.")) continue;
          if ((window.localStorage.getItem(k) ?? "").includes("local-")) poisoned.push(k);
        }
        if (poisoned.length) {
          for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i);
            if (k?.startsWith("taolu.")) poisoned.push(k);
          }
          [...new Set(poisoned)].forEach((k) => window.localStorage.removeItem(k));
        }
      }
    } catch { /* ignore */ }

    const storedSession = lsGet(LS_KEYS.session);
    const storedJudgeId = lsGet(LS_KEYS.judgeId);
    const storedRole = lsGet(LS_KEYS.role) as UserRole;

    if (storedSession) {
      setSessionCodeState(storedSession);
      if (storedJudgeId) setJudgeIdState(storedJudgeId);
      // Prefer the explicitly stored role; otherwise derive it from the judge slot.
      // IMPORTANT: check "AHJ" before "A" (since "AHJ".startsWith("A") is true).
      const derived: UserRole =
        storedRole ? storedRole :
        !storedJudgeId ? null :
        storedJudgeId.startsWith("AHJ") ? "assistant-referee" :
        storedJudgeId.startsWith("A")   ? "a-quality-judge" :
        storedJudgeId.startsWith("B")   ? "b-performance-judge" :
        storedJudgeId.startsWith("C")   ? "c-difficulty-judge" :
        null;
      setSelectedRole(derived);
      setSetupCompleteState(lsGet("taolu.setupComplete") === "1");
    } else {
      // No stored session → clean slate on RoleSelection.
      lsSet(LS_KEYS.role, null);
      lsSet(LS_KEYS.judgeId, null);
      lsSet("taolu.setupComplete", null);
      setSelectedRole(null);
      setSessionCodeState(null);
      setJudgeIdState(null);
      setSetupCompleteState(false);
    }
    setStorageHydrated(true);
  }, []);




  const approvedJudges = useMemo(() => Object.keys(judgeAssignments), [judgeAssignments]);

  // Group A ceiling depends on the live mode: 7.00 compulsory · 5.00 optional.
  const judgeAScore = useMemo(() => {
    const total = judgeADeductions.reduce((sum, d) => sum + d.value, 0);
    return Math.max(0, effMaxA - total);
  }, [judgeADeductions, effMaxA]);

  // Average B uses ONLY scores from currently-assigned B judges within the configured numB slots
  const activeBScores = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < team.numB; i++) {
      const key = `B${i + 1}`;
      if (judgeAssignments[key] !== undefined) {
        const override = judgeOverrides[key];
        const v = override !== undefined && override !== null ? override : judgeBScores[i];
        if (typeof v === "number") out.push(v);
      }
    }
    return out;
  }, [judgeAssignments, judgeOverrides, judgeBScores, team.numB]);

  const judgeBAverage = useMemo(() => {
    if (activeBScores.length === 0) return 0;
    // Dynamic Judges Management: trim high & low ONLY when 5+ active scores.
    // For 1–4 active judges → simple arithmetic mean (no trimming).
    let scores = [...activeBScores];
    if (scores.length >= 5) {
      scores.sort((a, b) => a - b);
      scores = scores.slice(1, -1);
    }
    const sum = scores.reduce((s, v) => s + v, 0);
    return Math.round((sum / scores.length) * 100) / 100;
  }, [activeBScores]);

  const biasAlerts = useMemo(() => {
    const avg = judgeBAverage;
    return judgeBScores
      .map((score, judgeIndex) => ({ judgeIndex, score, average: avg }))
      .filter(({ score }) => Math.abs(score - avg) > 0.5);
  }, [judgeBScores, judgeBAverage]);

  // Group C = movement difficulty (max 1.40) + connection difficulty (max 0.60) = 2.00
  const judgeCScore = useMemo(() => {
    const ok = judgeCAttempts.filter(a => a.successful);
    const mov = ok.filter(a => a.kind !== "connection").reduce((s, a) => s + a.value, 0);
    const con = ok.filter(a => a.kind === "connection").reduce((s, a) => s + a.value, 0);
    const total = Math.min(caps.maxCMovement, mov) + Math.min(caps.maxCConnection, con);
    return Math.round(Math.min(caps.maxC, total) * 100) / 100;
  }, [judgeCAttempts, caps.maxC, caps.maxCMovement, caps.maxCConnection]);

  const finalScore = useMemo(() => {
    const cContrib = includeC ? judgeCScore : 0;
    return Math.round((judgeAScore + judgeBAverage + cContrib) * 100) / 100;
  }, [judgeAScore, judgeBAverage, judgeCScore, includeC]);

  const setJudgeBScore = (index: number, score: number) => {
    setJudgeBScores(prev => prev.map((v, i) => i === index ? Math.round(Math.max(0, Math.min(effMaxB, score)) * 100) / 100 : v));
  };

  const resetJudgeBScores = () => setJudgeBScores(Array(MAX_B).fill(effMaxB));

  const setMovementStatus = useCallback((id: string, status: "success" | "fail") => {
    setMovementSequence(prev => prev.map(m => m.id === id ? { ...m, status } : m));
  }, []);

  const resetMovementSequence = useCallback(() => setMovementSequence(DEFAULT_MOVEMENTS), []);

  // When the live match mode flips (TA toggles Compulsory ↔ Optional), realign
  // the local B scores to the new perfect-score baseline so every B judge sees
  // 5.00 (Compulsory) or 3.00 (Optional) without page refresh.
  // FIX: also handle the FIRST resolved value (e.g. arriving from realtime as
  // "compulsory" after a default of "optional"), and clamp any value still over
  // the new ceiling. This kills the bug where Judge B was stuck at 3.00 even
  // though the panel header already showed "/ 5.00".
  const lastModeRef = useRef<MatchMode | null>(null);
  useEffect(() => {
    const prev = lastModeRef.current;
    if (prev !== liveMatchMode) {
      setJudgeBScores((curr) =>
        curr.map((v) => {
          // First sync OR mode flip → snap to the new perfect-score baseline.
          // This guarantees Judge B starts at 5.00 in Compulsory (and 3.00 in Optional).
          if (prev === null) return effMaxB;
          return effMaxB; // mode actually flipped → realign every judge
        })
      );
      lastModeRef.current = liveMatchMode;
    }
  }, [liveMatchMode, effMaxB]);

  // ===== Realtime sync of join requests for the current session =====
  // The chief calls generateSessionCode -> we create a row in `sessions`.
  // Anyone with that sessionCode subscribes to judge_requests filtered by it.
  type DBRow = {
    id: string;
    session_code: string;
    judge_name: string;
    requested_role: RequestedRole;
    status: "waiting" | "approved" | "rejected";
    assigned_slot: string | null;
    created_at: string;
  };

  const mapRow = (r: DBRow): JoinRequest => ({
    id: r.id,
    judgeName: r.judge_name,
    requestedRole: r.requested_role,
    requestedAt: new Date(r.created_at).getTime(),
    status: r.status === "approved" ? "assigned" : r.status,
    assignedKey: r.assigned_slot ?? undefined,
  });

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    // Tear down on session change
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (!sessionCode) {
      setJoinRequests([]);
      return;
    }

    let cancelled = false;
    // Initial fetch
    supabase.from("judge_requests").select("*").eq("session_code", sessionCode)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const rows = (data as DBRow[]).map(mapRow);
        setJoinRequests(rows);
        // rebuild assignments from approved rows
        const assigns: JudgeAssignments = {};
        rows.forEach(r => {
          if (r.status === "assigned" && r.assignedKey) assigns[r.assignedKey] = r.judgeName;
        });
        setJudgeAssignments(assigns);
      });

    // Realtime channel
    const ch = supabase
      .channel(`jr-${sessionCode}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "judge_requests", filter: `session_code=eq.${sessionCode}` },
        (payload) => {
          setJoinRequests(prev => {
            if (payload.eventType === "INSERT") {
              const row = mapRow(payload.new as DBRow);
              if (prev.some(r => r.id === row.id)) return prev;
              return [...prev, row];
            }
            if (payload.eventType === "UPDATE") {
              const row = mapRow(payload.new as DBRow);
              return prev.map(r => r.id === row.id ? row : r);
            }
            if (payload.eventType === "DELETE") {
              const oldId = (payload.old as { id: string }).id;
              return prev.filter(r => r.id !== oldId);
            }
            return prev;
          });

          // Mirror assignment side-effects
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            const row = mapRow(payload.new as DBRow);
            if (row.status === "assigned" && row.assignedKey) {
              setJudgeAssignments(prev => ({ ...prev, [row.assignedKey!]: row.judgeName }));
            }
          }
          if (payload.eventType === "DELETE") {
            const old = payload.old as DBRow;
            if (old.assigned_slot) {
              setJudgeAssignments(prev => {
                const next = { ...prev };
                delete next[old.assigned_slot!];
                return next;
              });
            }
          }
        }
      )
      .subscribe();
    channelRef.current = ch;

    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [sessionCode]);

  const submitJoinRequest = useCallback(async (judgeName: string, requestedRole: RequestedRole): Promise<string> => {
    const code = sessionCode;
    if (!code) throw new Error("No session code set — enter a session code first.");
    console.log("[submitJoinRequest] inserting", { code, judgeName, requestedRole });
    const { data, error } = await supabase
      .from("judge_requests")
      .insert({
        session_code: code,
        judge_name: judgeName.trim() || "غير معروف",
        requested_role: requestedRole,
        status: "waiting",
      })
      .select()
      .single();
    if (error) {
      console.error("[submitJoinRequest] insert failed:", error);
      throw new Error(error.message || "Insert failed");
    }
    if (!data) throw new Error("Insert returned no data");
    console.log("[submitJoinRequest] success", data);
    return (data as DBRow).id;
  }, [sessionCode]);

  const assignJudge = useCallback((requestId: string, judgeKey: string) => {
    // Optimistic — realtime will reconcile
    setJudgeAssignments(prev => {
      const req = joinRequests.find(r => r.id === requestId);
      return { ...prev, [judgeKey]: req?.judgeName ?? "" };
    });
    supabase.from("judge_requests")
      .update({ status: "approved", assigned_slot: judgeKey })
      .eq("id", requestId)
      .then(({ error }) => {
        if (error) console.error("assignJudge error", error);
      });
  }, [joinRequests]);

  const rejectJoinRequest = useCallback((id: string) => {
    supabase.from("judge_requests").update({ status: "rejected" }).eq("id", id)
      .then(({ error }) => { if (error) console.error("reject error", error); });
  }, []);

  const revokeJudge = useCallback((judgeKey: string) => {
    setJudgeAssignments(prev => {
      const next = { ...prev };
      delete next[judgeKey];
      return next;
    });
    setJudgeOverrides(prev => ({ ...prev, [judgeKey]: null }));
    if (judgeKey.startsWith("B")) {
      const idx = parseInt(judgeKey.slice(1), 10) - 1;
      if (!Number.isNaN(idx)) {
        setJudgeBScores(prev => prev.map((v, i) => i === idx ? config.maxB : v));
      }
    }
    // Delete the approved row from DB so the judge knows they're revoked
    supabase.from("judge_requests")
      .delete()
      .eq("session_code", sessionCode ?? "")
      .eq("assigned_slot", judgeKey)
      .then(({ error }) => { if (error) console.error("revoke error", error); });
  }, [config.maxB, sessionCode]);

  // Chief / TA: when team config shrinks, revoke judges in removed slots AND
  // push the new config to current_match.payload.team so every other screen
  // (judges monitor, public display, judges) hot-swaps instantly.
  const setTeamConfigSafe = useCallback((cfg: TeamConfig) => {
    // Clamp 1..5 for all groups (Dynamic Judges Management spec).
    const safe: TeamConfig = {
      numA: Math.max(1, Math.min(5, Math.round(cfg.numA))),
      numB: Math.max(1, Math.min(5, Math.round(cfg.numB))),
      numC: Math.max(1, Math.min(5, Math.round(cfg.numC))),
    };
    setTeamConfig(safe);
    setJudgeAssignments(prev => {
      const next: JudgeAssignments = {};
      Object.entries(prev).forEach(([k, name]) => {
        const group = k[0] as "A" | "B" | "C";
        const n = parseInt(k.slice(1), 10);
        const limit = group === "A" ? safe.numA : group === "B" ? safe.numB : safe.numC;
        if (n <= limit) next[k] = name;
      });
      return next;
    });
    if (sessionCode) {
      void pushTeamConfig(sessionCode, safe).catch((e) => console.warn("[team] push failed", e));
    }
  }, [sessionCode]);

  // Mirror remote team config changes (any peer updated it) → local state.
  const remoteTeam = useTeamSync(sessionCode);
  useEffect(() => {
    if (!remoteTeam) return;
    setTeamConfig((prev) => {
      if (prev.numA === remoteTeam.numA && prev.numB === remoteTeam.numB && prev.numC === remoteTeam.numC) {
        return prev;
      }
      return remoteTeam;
    });
  }, [remoteTeam]);

  const setSessionCode = useCallback((code: string | null) => {
    setSessionCodeState(code);
    if (code) void joinSessionMembership(code);
  }, []);
  const setJudgeId = useCallback((id: string | null) => setJudgeIdState(id), []);

  // VAR Broadcast (v1.1.4): Chief toggles; we broadcast via match_events so
  // every connected PublicDisplay / VAR / Scoreboard tab on the same session
  // flips in real time. Followers also subscribe (below) to mirror state.
  const setIsVarLiveOnPublic = useCallback((v: boolean) => {
    setIsVarLiveOnPublicState(v);
    if (sessionCode) {
      void supabase.from("match_events").insert({
        session_code: sessionCode,
        event_type: v ? "var_broadcast_on" : "var_broadcast_off",
        payload: {},
      });
    }
  }, [sessionCode]);

  // Subscribe to var_broadcast_* events on the active session — every device
  // (Public Display, VAR Review, Scoreboard, Chief) mirrors the same flag.
  useEffect(() => {
    if (!sessionCode) { setIsVarLiveOnPublicState(false); return; }
    const ch = supabase
      .channel(`var-bcast-${sessionCode}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "match_events", filter: `session_code=eq.${sessionCode}` },
        (payload) => {
          const ev = (payload.new as { event_type?: string }).event_type;
          if (ev === "var_broadcast_on") setIsVarLiveOnPublicState(true);
          else if (ev === "var_broadcast_off") setIsVarLiveOnPublicState(false);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionCode]);

  // ===== STRICT SESSION ISOLATION (v1.1.2) =====
  // Whenever sessionCode changes (new session, switched session, or cleared),
  // flush ALL per-session in-memory state and wipe any cached per-session
  // localStorage so no athlete/score from a previous session can leak into
  // the new session view.
  const prevSessionRef = useRef<string | null>(null);
  useEffect(() => {
    // Clear in-memory per-session state on every sessionCode transition
    setJoinRequests([]);
    setJudgeAssignments({});
    setJudgeOverrides({});
    setSubmittedSlots([]);
    setJudgeADeductions([]);
    setDeductionTimes([]);
    setJudgeBScores(Array(MAX_B).fill(3.0));
    setJudgeCAttempts([]);
    setMovementSequence(DEFAULT_MOVEMENTS);
    setSuggestedDeductions([]);
    setAhjReady(false);
    setScoreRevealed(false);
    setResults({});
    setReports({});
    setAthletes([]);
    setCurrentAthleteIndex(0);
    setTimerElapsed(0);
    setTimerRunning(false);
    setContinuityPause(0);
    setIsVarLiveOnPublicState(false);

    // Wipe per-session caches in localStorage so a stale tab can't replay
    // a previous session's athlete/score data.
    if (typeof window !== "undefined" && prevSessionRef.current !== sessionCode) {
      try {
        const KEEP = new Set([
          LS_KEYS.auth, LS_KEYS.role, LS_KEYS.session, LS_KEYS.judgeId, "taolu.setupComplete",
        ]);
        const toRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (!k) continue;
          // Drop any cached per-session display/var/scoreboard data
          if (k === "var_session" || k.startsWith("taolu.cache.") || k.startsWith("display.")) {
            toRemove.push(k);
          } else if (!KEEP.has(k) && k.startsWith("taolu.")) {
            // Also drop any other per-session taolu.* caches we don't explicitly keep
            toRemove.push(k);
          }
        }
        toRemove.forEach(k => window.localStorage.removeItem(k));
      } catch { /* ignore */ }
    }
    prevSessionRef.current = sessionCode;
  }, [sessionCode]);

  // Persist role/session/judgeId so reloads & new tabs (CAST) keep the user in place.
  // Auth is NEVER persisted locally — the Supabase session is the single source of truth.
  useEffect(() => { if (storageHydrated) lsSet(LS_KEYS.session, sessionCode); }, [storageHydrated, sessionCode]);
  useEffect(() => { if (storageHydrated) lsSet(LS_KEYS.judgeId, judgeId); }, [storageHydrated, judgeId]);
  useEffect(() => { if (storageHydrated) lsSet(LS_KEYS.role, selectedRole); }, [storageHydrated, selectedRole]);

  // MEMBERSHIP HEALING: after a reload (or when the anonymous device identity is
  // re-created) the membership row that RLS requires for writes may be missing.
  // Re-register it whenever we have both an authenticated device and a session.
  useEffect(() => {
    if (!storageHydrated || !sessionCode || !isAuthenticated) return;
    void joinSessionMembership(sessionCode, selectedRole ?? undefined, judgeId ?? undefined);
  }, [storageHydrated, sessionCode, isAuthenticated, selectedRole, judgeId]);


  // ===== Master / Follower architecture =====
  // The Technical Assistant (TA) is the MASTER controller for the competition.
  // - TA writes athlete_id, style, match_mode and timer transitions to current_match.
  // - All other roles (Chief, Judges A/B/C, Public Display) are FOLLOWERS:
  //   they subscribe via useMatchSync and mirror state locally.
  // - Chief retains the ability to start/pause the timer as a backup authority,
  //   because Chief is the official judge of record.
  const isTA = selectedRole === "technical-assistant";
  const isChief = selectedRole === "chief-referee";

  // Chief: relay local timer toggle to DB (backup authority — TA is primary).
  const prevTimerRunning = useRef(timerRunning);
  useEffect(() => {
    if (!isChief || !sessionCode) return;
    if (prevTimerRunning.current === timerRunning) return;
    prevTimerRunning.current = timerRunning;
    if (timerRunning) {
      void matchControl.start(sessionCode);
    } else {
      void matchControl.pause(sessionCode);
    }
  }, [isChief, sessionCode, timerRunning]);

  // Followers (everyone except TA): mirror authoritative state from current_match.
  const sync = useMatchSync(isTA ? null : sessionCode);
  useEffect(() => {
    if (isTA) return;
    setTimerElapsed(sync.elapsedSec);
    setTimerRunning(sync.timerState === "running");
  }, [isTA, sync.elapsedSec, sync.timerState]);

  // Followers: mirror style broadcast by TA
  useEffect(() => {
    if (isTA) return;
    if (sync.style && sync.style !== competitionStyle) {
      setCompetitionStyle(sync.style as CompetitionStyle);
    }
  }, [isTA, sync.style, competitionStyle]);

  // Followers: when TA broadcasts athlete metadata + difficulty sheet,
  // attach them to the local athlete record so all panels render correctly.
  useEffect(() => {
    if (isTA) return;
    const sheet = sync.payload?.difficultySheet as Athlete["difficultySheet"] | undefined;
    const athleteMeta = sync.payload?.athlete as { id?: string; name?: string; bib?: string | null; club?: string | null; country?: string | null } | undefined;
    const athleteId = sync.athleteId;
    if (!athleteId) return;
    setAthletes(prev => {
      const idx = prev.findIndex(a => a.id === athleteId);
      if (idx < 0) {
        return [...prev, {
          id: athleteId,
          name: athleteMeta?.name ?? "—",
          country: athleteMeta?.country ?? "—",
          category: "—",
          order: prev.length + 1,
          difficultySheet: sheet ?? [],
        }];
      }
      const a = prev[idx];
      const sheetSame = !sheet || (a.difficultySheet && JSON.stringify(a.difficultySheet) === JSON.stringify(sheet));
      const nameSame = !athleteMeta?.name || a.name === athleteMeta.name;
      if (sheetSame && nameSame) return prev;
      const next = [...prev];
      next[idx] = {
        ...a,
        name: athleteMeta?.name ?? a.name,
        country: athleteMeta?.country ?? a.country,
        difficultySheet: sheet ?? a.difficultySheet,
      };
      return next;
    });
  }, [isTA, sync.payload, sync.athleteId]);

  // Followers: keep currentAthleteIndex pinned to the TA's athleteId.
  // When TA clears the athlete (atomic reset), all followers (including Chief)
  // revert to a clean "Waiting for Athlete" state.
  useEffect(() => {
    if (isTA) return;
    if (!sync.athleteId) {
      setJudgeADeductions([]);
      setDeductionTimes([]);
      setJudgeBScores(Array(MAX_B).fill(3.0));
      setJudgeCAttempts([]);
      setTimerElapsed(0);
      setTimerRunning(false);
      return;
    }
    const i = athletes.findIndex(a => a.id === sync.athleteId);
    if (i >= 0 && i !== currentAthleteIndex) setCurrentAthleteIndex(i);
  }, [isTA, sync.athleteId, athletes, currentAthleteIndex]);

  // Chief: subscribe to live judge_scores submissions from sub-judges
  // Tracks both the score values AND which slots have submitted for the current athlete
  const [submittedSlots, setSubmittedSlots] = useState<string[]>([]);
  useEffect(() => {
    if (!isChief || !sessionCode) return;
    const currentAthleteId = athletes[currentAthleteIndex]?.id ?? null;
    setSubmittedSlots([]); // reset on athlete change

    const applyRow = (r: { judge_slot: string; score: number | null; athlete_id: string | null; submitted?: boolean }) => {
      // Strict athlete match — discard scores for other athletes
      if (currentAthleteId && r.athlete_id && r.athlete_id !== currentAthleteId) return;
      if (typeof r.score !== "number") return;
      const s = r.score;
      setJudgeOverrides(prev => ({ ...prev, [r.judge_slot]: s }));
      if (r.judge_slot.startsWith("B")) {
        const idx = parseInt(r.judge_slot.slice(1), 10) - 1;
        if (!Number.isNaN(idx)) {
          setJudgeBScores(prev => prev.map((v, i) => i === idx ? s : v));
        }
      }
      setSubmittedSlots(prev => prev.includes(r.judge_slot) ? prev : [...prev, r.judge_slot]);
    };

    void supabase.from("judge_scores").select("judge_slot, score, athlete_id, submitted")
      .eq("session_code", sessionCode)
      .then(({ data }) => { (data ?? []).forEach(applyRow); });

    const ch = supabase
      .channel(`js-${sessionCode}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "judge_scores", filter: `session_code=eq.${sessionCode}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as { judge_slot?: string };
            if (old?.judge_slot) setSubmittedSlots(prev => prev.filter(s => s !== old.judge_slot));
            return;
          }
          applyRow(payload.new as { judge_slot: string; score: number | null; athlete_id: string | null; submitted?: boolean });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [isChief, sessionCode, athletes, currentAthleteIndex]);


  // "خروج" = leave the current role/session, NOT a credential sign-out.
  // The silent device session stays alive so the operator can immediately pick
  // another role (or tap an NFC card) without any login screen.
  const logout = () => {
    setSelectedRole(null);
    setSessionCodeState(null);
    setJudgeIdState(null);
    setSetupComplete(false);
    lsSet(LS_KEYS.role, null);
    lsSet(LS_KEYS.session, null);
    lsSet(LS_KEYS.judgeId, null);
    // Drop the tab marker so the next load starts on Role Selection, never on the
    // previously used station.
    try { if (typeof window !== "undefined") window.sessionStorage.removeItem("taolu.tab"); } catch { /* ignore */ }
  };



  return (
    <CompetitionContext.Provider
      value={{
        storageHydrated,
        isAuthenticated, selectedRole, competitionStyle, athletes, currentAthleteIndex,
        timerRunning, timerElapsed, continuityPause,
        sessionCode, judgeId,
        generateSessionCode: async () => {
          // CLEAN SLATE: before issuing a new session code, purge ALL server-side
          // rows tied to the previous session so the public display, judges and
          // chief never see leftover athletes/scores from a prior tournament.
          const prev = sessionCode;
          if (prev) {
            void Promise.all([
              supabase.from("current_match").delete().eq("session_code", prev),
              supabase.from("judge_scores").delete().eq("session_code", prev),
              supabase.from("judge_status").delete().eq("session_code", prev),
              supabase.from("match_events").delete().eq("session_code", prev),
              supabase.from("match_results").delete().eq("session_code", prev),
              supabase.from("judge_requests").delete().eq("session_code", prev),
              supabase.from("sessions").update({ active: false }).eq("code", prev),
            ]).catch((e) => console.warn("[SESSION RESET] cleanup failed", e));
          }
          await ensureDeviceSession();

          // Never display/share a code until the backend confirms it exists.
          // Previously this state update happened before the insert, so an auth
          // startup race could leave the Chief sharing a code that was never saved.
          for (let attempt = 0; attempt < 5; attempt += 1) {
            const code = generateCode();
            const { error } = await supabase.from("sessions").insert({ code, active: true });
            if (!error) {
              await joinSessionMembership(code, "chief");
              setSessionCodeState(code);
              return;
            }
            if (error.code !== "23505") {
              console.error("[session] creation failed", error);
              throw new Error("تعذر إنشاء رمز الجلسة. تحقق من الاتصال وحاول مجدداً.");
            }
          }
          throw new Error("تعذر إنشاء رمز فريد للجلسة. حاول مجدداً.");
        },
        setSessionCode, setJudgeId,
        setupComplete, setSetupComplete,
        team, setTeamConfig: setTeamConfigSafe,
        judgeADeductions, judgeAScore,
        judgeBScores, judgeBAverage, biasAlerts,
        judgeCAttempts, judgeCScore,
        movementSequence, setMovementStatus, resetMovementSequence,
        finalScore, scoreRevealed, setScoreRevealed,
        setAuthenticated, setSelectedRole, setCompetitionStyle, setAthletes, setCurrentAthleteIndex,
        setTimerRunning, setTimerElapsed, setContinuityPause,
        addJudgeADeduction: (d: AppliedDeduction) => {
          setJudgeADeductions(prev => [...prev, d]);
          setDeductionTimes(prev => [...prev, timerElapsed]);
        },
        resetJudgeADeductions: () => { setJudgeADeductions([]); setDeductionTimes([]); },
        setJudgeBScore, resetJudgeBScores,
        addJudgeCAttempt: (a: DifficultyAttempt) => setJudgeCAttempts(prev => [...prev, a]),
        toggleJudgeCAttempt: (i: number) => setJudgeCAttempts(prev => prev.map((a, idx) => idx === i ? { ...a, successful: !a.successful } : a)),
        resetJudgeCAttempts: () => setJudgeCAttempts([]),
        aiMessages,
        addAiMessage: (msg) => setAiMessages(prev => [...prev, msg]),
        clearAiMessages: () => setAiMessages([]),
        joinRequests,
        judgeAssignments,
        approvedJudges,
        submitJoinRequest,
        assignJudge,
        rejectJoinRequest,
        revokeJudge,
        judgeOverrides,
        setJudgeOverride: (judgeKey, score) => setJudgeOverrides(prev => ({ ...prev, [judgeKey]: score })),
        submittedSlots,
        marqueeText,
        setMarqueeText,
        sponsorLogos,
        addSponsorLogo: (url) => setSponsorLogos(prev => [...prev, url]),
        removeSponsorLogo: (index) => setSponsorLogos(prev => prev.filter((_, i) => i !== index)),
        leaderboardMode,
        setLeaderboardMode,
        results,
        commitCurrentResult: () => {
          const a = athletes[currentAthleteIndex];
          if (!a) return;
          setResults(prev => ({ ...prev, [a.id]: finalScore }));
          const report: AthleteReport = {
            athleteId: a.id,
            athleteName: a.name,
            country: a.country,
            category: a.category,
            style: competitionStyle,
            finalScore,
            judgeAScore,
            judgeBAverage,
            judgeCScore,
            deductions: judgeADeductions.map((d, i) => ({
              code: d.code, value: d.value, label: d.label,
              timeSec: deductionTimes[i] ?? 0,
            })),
            performanceTime: config.performanceTime,
            committedAt: Date.now(),
          };
          setReports(prev => ({ ...prev, [a.id]: report }));
          // AUTO CLEANUP (v1.1.4): publishing a final score returns the public
          // screen to the scoreboard view by turning the VAR broadcast OFF.
          setIsVarLiveOnPublic(false);
        },
        clearResults: () => { setResults({}); setReports({}); },
        getLeaderboard: () =>
          athletes
            .map(a => ({ athlete: a, score: results[a.id] ?? -1 }))
            .filter(x => x.score >= 0)
            .sort((a, b) => b.score - a.score),
        reports,
        getReport: (athleteId: string) => reports[athleteId] ?? null,
        styleMode,
        setStyleMode,
        suggestedDeductions,
        addSuggestedDeduction: (s) => setSuggestedDeductions(prev => [...prev, { ...s, createdAt: Date.now() }]),
        clearSuggestedDeductions: () => setSuggestedDeductions([]),
        ahjReady,
        signalHeadJudge: () => setAhjReady(true),
        clearAhjSignal: () => setAhjReady(false),
        isVarLiveOnPublic,
        setIsVarLiveOnPublic,
        logout,
      }}
    >
      {children}
    </CompetitionContext.Provider>
  );
}
