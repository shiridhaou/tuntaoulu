import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Calendar, MapPin, Trophy, Play, CheckCircle2,
  Clock, Loader2, LogOut, Trash2, FileSpreadsheet, Search,
  Download, Settings, KeyRound, Copy, X, FileCheck2,
  Timer, Pause, RotateCcw, AlertTriangle, Megaphone,
  Activity, LogIn, UserPlus, Lock, Unlock, Plus, Minus,
  Radio, Zap, Video,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTrigger } from "./ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { joinSessionMembership } from "@/lib/sessionMembership";
import { matchControl, broadcastSessionState } from "@/hooks/useMatchSync";
import { getWebhookSettings, saveWebhookSettings, isValidWebhookUrl, type WebhookSettings } from "@/lib/resultsWebhook";
import { dateInputProps, fmtClock } from "@/lib/numFormat";
import { cleanUuid, newUuid } from "@/lib/uuid";
import { normalizeStyle, styleLabelAr } from "@/lib/styleNames";
import { FederationLogo } from "./FederationLogo";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Badge } from "./ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./ui/tabs";
import { toast } from "sonner";
import { useCompetition } from "@/store/competition-store";
import { classifyAge, AGE_CATEGORY_COLORS, type AgeCategory } from "@/lib/ageCategories";
import { CATEGORY_TIME_RULES, checkCategoryTime, fmtRuleWindow } from "@/lib/categoryTimeRules";

// ── الاستخراجات المجمعة ──────────────────────────────────
import { normalizeRow, type NormalizedAthleteRow, type DifficultyItem } from "@/lib/importParsing";
import { useAthleteImport, type ImportedAthleteRecord } from "@/hooks/useAthleteImport";
import { useMatchTimer, computeMatchPhase } from "@/hooks/useMatchTimer";
import { useTournament } from "@/hooks/useTournament";
import { DifficultyManager } from "./DifficultyManager";
import { JudgesStatusGrid, type JudgeTeamSize } from "./JudgesStatusGrid";
import { TeamSizeControls } from "./TeamSizeControls";
import type { JudgeStatusRow } from "@/types/matchTypes";




const STATUS_META: Record<Athlete["status"], { label: string; cls: string; icon: any }> = {
  waiting: { label: "انتظار", cls: "bg-muted/40 text-muted-foreground border-muted", icon: Clock },
  judging: { label: "جاري التحكيم", cls: "bg-fed-blue/15 text-fed-blue border-fed-blue/40", icon: Loader2 },
  done:    { label: "انتهى", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40", icon: CheckCircle2 },
};

const CATEGORIES: AgeCategory[] = ["Poussins", "Pupilles", "Benjamins", "Minimes", "Cadets", "Juniors", "Seniors"];

// ============================================================================
// SESSION GATE: TA must enter chief's session code before accessing dashboard
// ============================================================================
function SessionEntryGate({ onConnected }: { onConnected: (code: string) => void }) {
  const { logout } = useCompetition();
  const [code, setCode] = useState("");
 

  async function connect() {
    const c = code.trim().toUpperCase();
    if (c.length < 4) { toast.error("أدخل رمز جلسة صالحاً"); return; }
    setLoading(true);
    try {
      const { data: active, error } = await supabase.rpc("is_active_session", { _code: c });
      if (error) throw error;
      if (!active) { toast.error("رمز الجلسة غير صحيح أو غير نشط"); return; }
      // Writes (tournament creation, athlete import) require an authenticated
      // device identity + a membership row. Establish both before entering.
      const { data: auth } = await supabase.auth.getSession();
      if (!auth.session) {
        const { error: authErr } = await supabase.auth.signInAnonymously();
        if (authErr) throw authErr;
      }
      await joinSessionMembership(c, "technical-assistant");
      toast.success("تم الاتصال بالجلسة");
      onConnected(c);
    } catch (e: any) {
      toast.error(e.message ?? "فشل الاتصال");
    } finally {
      setLoading(false);
    }
  }


  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      <div className="mesh-gradient-bg" />
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-8 w-full max-w-md relative z-10 border border-fed-blue/30"
      >
        <div className="flex flex-col items-center gap-3 mb-6">
          <FederationLogo size="md" />
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-widest text-fed-blue font-body">Technical Assistant</p>
            <h1 className="text-xl font-heading font-bold text-gold mt-1">الاتصال بجلسة التحكيم</h1>
            <p className="text-xs text-muted-foreground mt-1">أدخل رمز الجلسة الذي أنشأه الحكم الرئيسي</p>
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-xs flex items-center gap-1">
            <KeyRound className="h-3 w-3" /> رمز الجلسة
          </Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && connect()}
            placeholder="ABC123"
            className="text-center font-mono text-2xl tracking-widest h-14 bg-background/40"
            maxLength={8}
            autoFocus
          />

          <Button onClick={connect} disabled={loading || !code.trim()}
            className="w-full bg-gold text-navy hover:bg-gold/90 font-bold h-11">
            {loading
              ? <><Loader2 className="h-4 w-4 animate-spin ml-1" /> جارٍ الاتصال… · Connecting…</>
              : <><LogIn className="h-4 w-4 ml-1" /> دخول للوحة الإدارة</>}
          </Button>

          <Button onClick={logout} variant="ghost" className="w-full text-muted-foreground">
            <LogOut className="h-4 w-4 ml-1" /> رجوع
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center mt-5 leading-relaxed">
          المساعد التقني جزء من طاولة التحكيم الأساسية — لا يحتاج إلى موافقة الرئيس.
        </p>
      </motion.div>
    </div>
  );
}

export function TechnicalAssistantDashboard() {
  const { logout, sessionCode, setSessionCode } = useCompetition();

  // STEP 1: Force session entry (no auto-generation)
  if (!sessionCode) {
    return <SessionEntryGate onConnected={(c) => setSessionCode(c)} />;
  }

  return <TADashboardInner key={sessionCode} />;
}

function TADashboardInner() {
  const { logout, sessionCode, setSessionCode, team, setTeamConfig } = useCompetition();
 
 
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<AgeCategory | "all">("all");
  const [dragOver, setDragOver] = useState(false);
 
  const [tab, setTab] = useState("import");
  const fileRef = useRef<HTMLInputElement>(null);

  // Manual add athlete dialog
  const [manualOpen, setManualOpen] = useState(false);
  // Official category/style time preset — drives ALL automatic time deductions.
  const [timeRuleId, setTimeRuleId] = useState<string>(DEFAULT_CATEGORY_RULE_ID);
  const [manualForm, setManualForm] = useState({ bib: "", name: "", club: "", country: "Tunisia", gender: "", birth_date: "", category: "" as AgeCategory | "" });
  const [manualSaving, setManualSaving] = useState(false);

  // Official timer — TA is the master. We mirror DB state via useMatchSync so
  // the timer displayed here is the same one Chief / Judges / Public see.
 

  // RC-7 — athletes that live only in the local queue because their background
  // database sync failed. Surfaced as a non-blocking badge with manual retry.




  // Manually selected athlete (from the queue table "اختيار / Select" action).
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Match config (broadcast to judges via current_match.payload)
  const [matchMode, setMatchMode] = useState<"compulsory" | "optional">("optional");
  const [styleCategory, setStyleCategory] = useState<"changquan" | "nanquan" | "taijiquan" | "traditional">("changquan");
  const [configLocked, setConfigLocked] = useState(false);

  // Results export webhook (UI-level; stored per session in localStorage)
  const [webhook, setWebhook] = useState<WebhookSettings>({ enabled: false, url: "" });
  useEffect(() => { setWebhook(getWebhookSettings(sessionCode)); }, [sessionCode]);

  // LIVE BROADCAST of match config (mode / style / category) — pushes to
  // current_match + an instant realtime broadcast so every Judge A/B/C panel
  // reloads its active rules engine without a refresh.
  useEffect(() => {
    if (!sessionCode) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: existing, error: readErr } = await supabase
          .from("current_match")
          .select("athlete_id, payload, style")
          .eq("session_code", sessionCode)
          .maybeSingle();
        if (readErr) throw readErr;
        if (cancelled) return;
        const prev = (existing?.payload as Record<string, unknown> | null) ?? {};
        const sameMode = (prev.match_mode as string | undefined) === matchMode;
        const sameStyle = (existing?.style ?? null) === styleCategory && (prev.style as string | undefined) === styleCategory;
        const sameRule = (prev.time_rule_id as string | undefined) === timeRuleId;
        if (sameMode && sameStyle && sameRule) return;

        const nextPayload = { ...prev, match_mode: matchMode, style: styleCategory, time_rule_id: timeRuleId };

        // 1) Instant push (sub-second) to all connected panels.
        await broadcastSessionState(sessionCode, { style: styleCategory, payload: nextPayload });

        // 2) Authoritative persistence for late joiners / reloads.
        const { error: writeErr } = await supabase.from("current_match").upsert({
          session_code: sessionCode,
          athlete_id: existing?.athlete_id ?? null,
          style: styleCategory,
          payload: nextPayload as never,
          updated_at: new Date().toISOString(),
        }, { onConflict: "session_code" });
        if (writeErr) throw writeErr;

        await supabase.from("match_events").insert({
          session_code: sessionCode,
          event_type: "session_state_change",
          payload: { match_mode: matchMode, style: styleCategory, time_rule_id: timeRuleId },
        });
        if (!cancelled) pushLog("config", `📡 بث: ${styleCategory} · ${matchMode}`);
      } catch (e: any) {
        if (!cancelled) toast.error(`فشل بث الإعدادات للحكام: ${e?.message ?? "خطأ"}`);
      }
    })();
    return () => { cancelled = true; };
  }, [matchMode, sessionCode, styleCategory, timeRuleId]);


  // Event log (collapsible drawer)
  const [eventLog, setEventLog] = useState<{ ts: number; type: string; label: string }[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  // OOB visual feedback (framer-motion pulse trigger)
  const [oobPulse, setOobPulse] = useState(0);

  function pushLog(type: string, label: string) {
    setEventLog((l) => [{ ts: Date.now(), type, label }, ...l].slice(0, 50));
  }

  useEffect(() => {
    void loadActive();
    const tid = tournament?.id ?? null;
    const ch = supabase
      .channel(`ta-${sessionCode}-${tid ?? "all"}`)
      // RC-6: scope athlete changes to this tournament so concurrent events
      // don't trigger a full refetch on this screen.
      .on("postgres_changes",
        tid
          ? { event: "*", schema: "public", table: "athletes", filter: `tournament_id=eq.${tid}` }
          : { event: "*", schema: "public", table: "athletes" },
        () => loadActive())
      .on("postgres_changes",
        { event: "*", schema: "public", table: "tournaments", filter: `session_code=eq.${sessionCode}` },
        () => loadActive())
      .on("postgres_changes",
        { event: "*", schema: "public", table: "judge_status", filter: `session_code=eq.${sessionCode}` },
        () => loadJudgeStatuses())
      .subscribe();
    void loadJudgeStatuses();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tournament?.id]);


  // Timer ticks are driven by useMatchSync (1Hz local extrapolation while running).





async function loadActive() {
    const t = await reloadTournament();
    if (!t) return;
    const { data: a } = await supabase
      .from("athletes").select("*").eq("tournament_id", t.id)
      .order("bib_number", { ascending: true });
    setAthletes((prev) => {
      const remote = (a ?? []) as Athlete[];
      const ids = new Set(remote.map((x) => x.id));
      return [...remote, ...prev.filter((x) => !ids.has(x.id))];
    });
  }
      


  async function loadJudgeStatuses() {
    if (!sessionCode) return;
    const { data } = await supabase
      .from("judge_status").select("judge_slot, state, athlete_id")
      .eq("session_code", sessionCode);
    setJudgeStatuses((data ?? []) as JudgeStatusRow[]);
  }

  async function emitEvent(event_type: string, payload: Record<string, any> = {}) {
    if (!sessionCode) return;
    await supabase.from("match_events").insert({ session_code: sessionCode, event_type, payload });
  }

  /**
   * RC-2 — deep merge of `current_match.payload`.
   * Reads the existing payload, spreads the patch over it and writes it back,
   * so keys owned by other subsystems (payload.team, payload.display, …) are
   * never wiped when the TA calls or starts an athlete.
   */
  async function mergeMatchPayload(
    code: string,
    patch: Record<string, unknown>,
    row: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    const { data: existing } = await supabase
      .from("current_match")
      .select("athlete_id, style, payload")
      .eq("session_code", code)
      .maybeSingle();
    const prev = (existing?.payload as Record<string, unknown> | null) ?? {};
    const merged = { ...prev, ...patch };
    await supabase.from("current_match").upsert({
      session_code: code,
      athlete_id: "athlete_id" in row ? row.athlete_id : (existing?.athlete_id ?? null),
      style: "style" in row ? row.style : (existing?.style ?? null),
      ...row,
      payload: merged as never,
      updated_at: new Date().toISOString(),
    } as never, { onConflict: "session_code" });
    return merged;
  }



  function describeDbError(e: any): string {
    const parts = [e?.message, e?.details, e?.hint, e?.code ? `code=${e.code}` : null]
      .filter(Boolean);
    return parts.join(" — ") || "خطأ غير معروف";
  }

  /**
   * Local-first: the form is committed to local context + localStorage right
   * away, then pushed to the database in the background. Database problems are
   * logged (and surfaced as a soft notice) but never block the panel.
   */


    // 1) Local source of truth — instant.
    const isNew = !tournament;
    const localTournament = {
      // MUST be a canonical UUID — prefixed ids break every FK insert (22P02).
      id: cleanUuid(tournament?.id) ?? newUuid(),
      ...payload,
      created_at: (tournament as any)?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as Tournament;
    setTournament(localTournament);
    writeLocalTournament(localTournament);
    toast.success(isNew ? "تم إنشاء البطولة" : "تم تحديث البطولة");
    if (isNew) setTab("import");

    // 2) Background sync — never blocks or fails the UI.
    void (async () => {
      try {
        await ensureDeviceSession();
        await joinSessionMembership(sessionCode ?? "", "technical-assistant");
        const { data, error } = await supabase
          .from("tournaments")
          .upsert({ id: localTournament.id, ...payload }, { onConflict: "id" })
          .select().single();
        if (error) throw error;
        if (data) {
          setTournament(data as Tournament);
          writeLocalTournament(data as Tournament);
        }
      } catch (e: any) {
        console.warn("[tournaments] background sync failed — local context kept", describeDbError(e));
      }
    })();
  }


  /**
   * Returns a tournament_id that is guaranteed to be a canonical UUID AND to
   * exist in the database, so athlete inserts never hit 22P02 or an FK error.
   * Falls back to `null` (unlinked athletes) instead of blocking the import.
   */
const { tournament, form, setForm, reloadTournament, saveTournament, resolveTournamentId } =
  useTournament({ sessionCode });

const {
    preview, isImporting, unsynced, retrying,
    processFile, confirmImport, cancelImport, retryUnsynced,
  } = useAthleteImport({
    resolveTournamentId,
    onImported: (records: ImportedAthleteRecord[]) => {
      setAthletes((prev) => [...prev, ...(records as Athlete[])]);
      setTab("matches");
    },
  });




  function downloadTemplate() {
    const sample = [
      {
        number: "001", name: "محمد بن علي", gender: "M", birth_date: "2010-05-12",
        club: "نادي قرطاج", country: "Tunisia",
        difficulty_codes: "323A,324A,353A",
        C1_code: "323A", C1_value: 0.20, C1_label: "Tornado 360°",
        C2_code: "324A", C2_value: 0.20, C2_label: "Double Aerial Kick",
        C3_code: "353A", C3_value: 0.30, C3_label: "Aerial 360°",
      },
      {
        number: "002", name: "سارة الفهري", gender: "F", birth_date: "2015-09-03",
        club: "نادي تونس", country: "Tunisia",
        difficulty_codes: "312A,323B,353B",
        C1_code: "312A", C1_value: 0.20, C1_label: "Split Leap",
        C2_code: "323B", C2_value: 0.30, C2_label: "Tornado 540°",
        C3_code: "353B", C3_value: 0.40, C3_label: "Double Aerial Spin",
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Athletes");
    XLSX.writeFile(wb, "wushu_athletes_template.xlsx");
  }

  async function deleteAthlete(id: string) {
    const { error } = await supabase.from("athletes").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { setAthletes((a) => a.filter((x) => x.id !== id)); toast.success("تم الحذف"); }
  }

  async function clearAll() {
    if (!tournament || !confirm("حذف جميع اللاعبين؟")) return;
    const { error } = await supabase.from("athletes").delete().eq("tournament_id", tournament.id);
    if (error) toast.error(error.message);
    else { setAthletes([]); toast.success("تم مسح القائمة"); }
  }

  async function saveManualAthlete() {
    if (!tournament) { toast.error("أنشئ البطولة أولاً"); return; }
    if (!manualForm.name.trim()) { toast.error("اسم اللاعب مطلوب"); return; }
    setManualSaving(true);
    try {
      const cat = manualForm.category || (manualForm.birth_date ? classifyAge(manualForm.birth_date) : null);
      const tid = await resolveTournamentId();
      const { data: inserted, error } = await supabase.from("athletes").insert({
        tournament_id: tid,
        bib_number: manualForm.bib.trim() || null,
        full_name: manualForm.name.trim(),
        gender: manualForm.gender || null,
        birth_date: manualForm.birth_date || null,
        age_category: cat,
        club: manualForm.club.trim() || null,
        country: manualForm.country.trim() || null,
        style: styleCategory,
        status: "waiting",
      }).select().single();
      if (error) throw error;
      // Make the athlete selectable in the queue immediately (before the
      // realtime refresh lands).
      if (inserted) {
        setAthletes((prev) => {
          const next = [...prev.filter((a) => a.id !== (inserted as Athlete).id), inserted as Athlete];
          return next.sort((a, b) => (a.bib_number ?? "").localeCompare(b.bib_number ?? ""));
        });
      }
      pushLog("athlete", `➕ ${manualForm.name.trim()}`);
      toast.success("تمت إضافة اللاعب — جاهز في قائمة الانتظار");
      setManualForm({ bib: "", name: "", club: "", country: "Tunisia", gender: "", birth_date: "", category: "" });
      setManualOpen(false);
      void loadActive();
    } catch (e: any) { toast.error(e.message ?? "فشل الإضافة"); }
    finally { setManualSaving(false); }
  }

  async function startMatch(athlete: Athlete) {
    if (!sessionCode) { toast.error("لا يوجد رمز جلسة"); return; }
    // RC-1: optimistic local status authority — the queue, the call box and the
    // match phase flip instantly even for athletes that only exist locally.
    setAthletes((prev) => prev.map((a) =>
      a.id === athlete.id
        ? ({ ...a, status: "judging" } as Athlete)
        : a.status === "judging" ? ({ ...a, status: "waiting" } as Athlete) : a));
    if (tournament) {
      await supabase.from("athletes").update({ status: "waiting" }).eq("tournament_id", tournament.id).eq("status", "judging");
    }
    await supabase.from("athletes").update({ status: "judging" }).eq("id", athlete.id);

    // Build per-athlete difficulty sheet — prefer the curated `difficulty_sheet`
    // (rich {code,label,value}) edited by the TA in the black box, fall back to
    // the simple `difficulty_codes` array + IWUF catalog.
    const { data: aRow } = await supabase
      .from("athletes").select("difficulty_codes, difficulty_sheet").eq("id", athlete.id).maybeSingle();
    const curated = (aRow as { difficulty_sheet?: DifficultyItem[] | null } | null)?.difficulty_sheet
      ?? athlete.difficulty_sheet ?? [];
    const codes = (aRow as { difficulty_codes?: string[] } | null)?.difficulty_codes
      ?? athlete.difficulty_codes ?? [];
    let difficultySheet: DifficultyItem[] = [];
    if (Array.isArray(curated) && curated.length > 0) {
      difficultySheet = curated.map((d: any) => ({
        code: String(d.code ?? "").toUpperCase(),
        label: String(d.label ?? d.code ?? ""),
        value: Number(d.value ?? 0),
      })).filter((d) => d.code);
    } else if (codes.length) {
      const { buildDifficultySheet } = await import("@/lib/difficultyCodes");
      difficultySheet = buildDifficultySheet(codes) as DifficultyItem[];
    }

    // SINGLE source of truth — merged payload (team / display settings kept).
    // Reset timer to idle so all followers start clean.
    const liveStyle = normalizeStyle(athlete.style ?? styleCategory, styleCategory);
    const athletePayload = {
      id: athlete.id,
      name: athlete.full_name,
      bib: athlete.bib_number,
      club: athlete.club,
      country: athlete.country,
      category: athlete.age_category ?? null,
    };
    await mergeMatchPayload(sessionCode, {
      match_mode: matchMode,
      style: liveStyle,
      time_rule_id: timeRuleId,
      locked: configLocked,
      status: "LIVE",
      category: athlete.age_category ?? null,
      difficultySheet,
      movements: difficultySheet,
      athlete: athletePayload,
      activeAthlete: athletePayload,
    }, {
      athlete_id: athlete.id,
      style: liveStyle,
      timer_state: "idle",
      started_at: null,
      elapsed_ms: 0,
    });

    // Instant MATCH_STATE_CHANGE fan-out (Chief, A/B/C, VAR) + C-sheet push.
    await publishMatchState(athlete, "LIVE", difficultySheet);

    // Reset all existing judge slots to judging for this athlete
    await supabase.from("judge_status")
      .update({ state: "judging", athlete_id: athlete.id })
      .eq("session_code", sessionCode);
    // Clear stale scores from previous athletes for this session
    await supabase.from("judge_scores").delete().eq("session_code", sessionCode);

    setOobPoints(0);
    // Timer state already reset to idle by the upsert above (timer_state: 'idle', elapsed_ms: 0).
    await emitEvent("timer_reset");
    // Unified "ابدأ": the authoritative countdown starts with the match so all
    // judge panels, chief and the public display run the same clock.
    await matchControl.start(sessionCode);
    await emitEvent("match_started", {
      athlete_id: athlete.id, name: athlete.full_name,
      match_mode: matchMode, style: styleCategory,
      difficulty_count: difficultySheet.length,
      difficulty_sheet: difficultySheet,
    });
    pushLog("match", `▶ ${athlete.full_name} • ${styleCategory} • ${matchMode}`);
    toast.success(`بدأت مباراة ${athlete.full_name}`);
    void loadActive();
    void loadJudgeStatuses();
  }

  async function finishMatch(athlete: Athlete) {
    setAthletes((prev) => prev.map((a) => a.id === athlete.id ? ({ ...a, status: "done" } as Athlete) : a));
    await supabase.from("athletes").update({ status: "done" }).eq("id", athlete.id);
    if (sessionCode) {
      await supabase.from("current_match").update({ athlete_id: null }).eq("session_code", sessionCode);
      await matchControl.reset(sessionCode);
    }
    toast.success("تم إنهاء المباراة");
    void loadActive();
  }

  // GLOBAL RESET — clears state across ALL connected screens (judges, chief, display).
  // Nulling current_match.athlete_id triggers the follower effect in CompetitionProvider
  // which wipes scores, deductions, timer locally on every client.
  async function nextAthleteGlobalReset() {
    if (!sessionCode) { toast.error("لا يوجد رمز جلسة"); return; }
    if (liveAthlete) {
      const doneId = liveAthlete.id;
      setAthletes((prev) => prev.map((a) => a.id === doneId ? ({ ...a, status: "done" } as Athlete) : a));
      await supabase.from("athletes").update({ status: "done" }).eq("id", doneId);
    }
    // 1) Clear the live athlete pointer (followers reset locally)
    await supabase.from("current_match")
      .update({ athlete_id: null, ta_deductions: { time: { value: 0 }, oob: { count: 0, value: 0 }, total: 0 } as never })
      .eq("session_code", sessionCode);

    // 2) Reset authoritative timer
    await matchControl.reset(sessionCode);
    // 3) Wipe judge scores for this session
    await supabase.from("judge_scores").delete().eq("session_code", sessionCode);
    // 4) Unpublish previous result so scoreboard goes back to "—.——"
    await supabase.from("match_results")
      .update({ published: false }).eq("session_code", sessionCode).eq("published", true);
    // 5) Broadcast events for any custom listeners
    await emitEvent("global_reset", { at: Date.now() });
    await emitEvent("timer_reset");
    setOobPoints(0);
    pushLog("match", "🔄 GLOBAL RESET → next athlete · all screens cleared");
    toast.success("تم تصفير جميع الشاشات — جاهز للاعب التالي");
    void loadActive();
    void loadJudgeStatuses();
  }

  /** Resolve the athlete's Group C movements (curated sheet → codes → []). */
  async function resolveMovements(athlete: Athlete): Promise<DifficultyItem[]> {
    const { data: aRow } = await supabase
      .from("athletes").select("difficulty_codes, difficulty_sheet").eq("id", athlete.id).maybeSingle();
    const curated = ((aRow as any)?.difficulty_sheet ?? athlete.difficulty_sheet ?? []) as DifficultyItem[];
    const codes = ((aRow as any)?.difficulty_codes ?? athlete.difficulty_codes ?? []) as string[];
    if (Array.isArray(curated) && curated.length > 0) {
      return curated.map((d: any) => ({
        code: String(d.code ?? "").toUpperCase(),
        label: String(d.label ?? d.code ?? ""),
        value: Number(d.value ?? 0),
      })).filter((d) => d.code);
    }
    if (codes.length) {
      const { buildDifficultySheet } = await import("@/lib/difficultyCodes");
      return buildDifficultySheet(codes) as DifficultyItem[];
    }
    return [];
  }

  /**
   * Publish the full match state to every subscriber (Chief, A/B/C, VAR) —
   * writes the authoritative `current_match` row AND fires an instant
   * broadcast so panels flip off "WAITING FOR TA" without waiting for
   * postgres replication.
   */
  async function publishMatchState(
    athlete: Athlete,
    status: "CALLED" | "LIVE",
    movements: DifficultyItem[],
  ) {
    if (!sessionCode) return;
    const style = normalizeStyle(athlete.style ?? styleCategory, styleCategory);
    const athletePayload = {
      id: athlete.id,
      name: athlete.full_name,
      bib: athlete.bib_number,
      club: athlete.club,
      country: athlete.country,
      category: athlete.age_category ?? null,
    };
    const patch = {
      match_mode: matchMode,
      style,
      time_rule_id: timeRuleId,
      locked: configLocked,
      status,
      category: athlete.age_category ?? null,
      athlete: athletePayload,
      activeAthlete: athletePayload,
      movements,
      difficultySheet: movements,
    };

    // RC-2: deep merge so payload.team / payload.display survive every call.
    const payload = await mergeMatchPayload(sessionCode, patch, {
      athlete_id: athlete.id,
      style,
    });

    // Instant fan-out (MATCH_STATE_CHANGE) to all connected panels.
    await broadcastSessionState(sessionCode, { style, athlete_id: athlete.id, payload });

    await emitEvent("match_state_change", {
      activeAthlete: athletePayload,
      status,
      category: athlete.age_category ?? null,
      style,
      movements,
    });
  }

  async function callAthlete(athlete: Athlete) {
    const movements = await resolveMovements(athlete);
    await publishMatchState(athlete, "CALLED", movements);
    await emitEvent("call_next", {
      athlete_id: athlete.id,
      name: athlete.full_name,
      bib: athlete.bib_number,
      club: athlete.club,
      country: athlete.country,
      movements,
    });
    toast.success(`تم نداء اللاعب: ${athlete.full_name} — تم إرسال ${movements.length} حركة لحكام C`);
  }

  // ──────────────────────────────────────────────────────────────────────
  // TA-side deduction broadcaster: writes ta_deductions to current_match so
  // every dashboard (Chief, Public, Judges) sees the same automatic numbers.
const timer = useMatchTimer({
  sessionCode,
  timeRuleId,
  styleCategory,
  onLog: pushLog,
});

  // Signal Chief — emits a high-priority alert event the chief dashboard can surface.
  async function signalChief() {
    if (!sessionCode) { toast.error("لا يوجد رمز جلسة"); return; }
    const td = checkCategoryTime(timeRuleId, timer.timerSec);
    // RC-3: ride the ta_sync channel the Chief already listens to.
    await emitEvent("ta_sync", {
      signal: true,
      oob_count: timer.oobPoints, oob_deduction: timer.oobPoints* 0.1,
      time: timer.timerSec, time_deduction: td.value, time_reason: td.reason,
    });
    await emitEvent("ta_signal_chief", { at: timer.timerSec, oob: timer.oobPoints });
    pushLog("signal", "📣 Signaled Chief");
    toast.success("تم إرسال الإشارة للحكم الرئيسي");
  }



  // Broadcast VAR — asks the VAR referee to review the current athlete at the
  // exact timer position, and mirrors the request to the public display flag.
  async function broadcastVar() {
    if (!sessionCode) { toast.error("لا يوجد رمز جلسة"); return; }
    await emitEvent("var_review_request", {
      at: timer.timerSec,
      athlete_id: liveAthlete?.id ?? null,
      athlete_name: liveAthlete?.full_name ?? null,
      bib: liveAthlete?.bib_number ?? null,
      style: styleCategory,
      match_mode: matchMode,
    });
    pushLog("var", `🎥 VAR review @ ${Math.floor(timer.timerSec / 60)}:${String(timer.timerSec % 60).padStart(2, "0")}`);
    toast.success("تم إرسال طلب مراجعة الفيديو إلى حكم VAR");
  }

  // Lock match config and broadcast to all judges (preserves any existing athlete)
  async function lockAndStart() {
    if (!sessionCode) { toast.error("لا يوجد رمز جلسة"); return; }
    setConfigLocked(true);

    // Read current row to merge payload + keep athlete_id intact
    const { data: existing } = await supabase
      .from("current_match")
      .select("athlete_id, payload")
      .eq("session_code", sessionCode).maybeSingle();
    const prevPayload = (existing?.payload as Record<string, unknown> | null) ?? {};

    await supabase.from("current_match").upsert({
      session_code: sessionCode,
      athlete_id: existing?.athlete_id ?? null,
      style: styleCategory,
      payload: { ...prevPayload, match_mode: matchMode, style: styleCategory, locked: true } as never,
      updated_at: new Date().toISOString(),
    }, { onConflict: "session_code" });

    await emitEvent("config_locked", { match_mode: matchMode, style: styleCategory });
    pushLog("config", `Locked: ${matchMode.toUpperCase()} / ${styleCategory}`);
    toast.success("تم قفل الإعدادات وبثّها للحكام");
  }

  // RC-4: unlocking must reach every judge screen, not just local state.
  async function unlockConfig() {
    setConfigLocked(false);
    pushLog("config", "Unlocked config");
    if (!sessionCode) return;
    const payload = await mergeMatchPayload(sessionCode, { locked: false });
    await broadcastSessionState(sessionCode, { style: styleCategory, payload });
    await emitEvent("config_locked", { match_mode: matchMode, style: styleCategory, locked: false });
    toast.success("تم فتح الإعدادات للحكام");
  }


  // Sync deductions/OOB to chief — also re-broadcasts the consolidated ta_deductions
async function syncWithChief() {
    if (!sessionCode) return;
    await timer.broadcastTaDeductions({ atSec: timer.timerSec, oob: timer.oobPoints, final: !timer.timerRunning && timer.timerSec > 0 });
    const oobDeduction = timer.oobPoints * 0.1;
    const td = checkCategoryTime(timeRuleId, timer.timerSec);
    await emitEvent("ta_sync", {
      oob_count: timer.oobPoints, oob_deductions: oobDeduction,
      time:timer.timerSec, time_deduction: td.value, time_reason: td.reason,
    });
    const total = (oobDeduction + td.value).toFixed(1);
    pushLog("sync", `Synced → Chief (OOBx${timer.oobPoints} + Time → -${total})`);
    toast.success(`تمت المزامنة (إجمالي الخصومات تلقائياً -${total})`);
  }

  function copySession() {
    if (!sessionCode) return;
    navigator.clipboard.writeText(sessionCode);
    toast.success("تم نسخ رمز الجلسة");
  }

  function disconnect() {
    setSessionCode(null);
    toast.info("تم قطع الاتصال بالجلسة");
  }

  const filtered = useMemo(() => athletes.filter((a) => {
    if (filter !== "all" && a.age_category !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return a.full_name.toLowerCase().includes(q)
        || (a.bib_number ?? "").toLowerCase().includes(q)
        || (a.club ?? "").toLowerCase().includes(q)
        || (a.country ?? "").toLowerCase().includes(q);
    }
    return true;
  }), [athletes, filter, search]);

  const stats = useMemo(() => {
    const c: Record<string, number> = { total: athletes.length, waiting: 0, judging: 0, done: 0 };
    athletes.forEach((a) => { c[a.status] = (c[a.status] ?? 0) + 1; });
    return c;
  }, [athletes]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // RC-1: the authoritative current_match pointer wins; local status is the
  // fallback so locally-imported (not yet synced) athletes still go live.
  const liveAthlete =
    (sync.athleteId ? athletes.find((a) => a.id === sync.athleteId) : undefined)
    ?? athletes.find((a) => a.status === "judging")
    ?? null;

  const selectedAthlete = selectedId ? (athletes.find((a) => a.id === selectedId) ?? null) : null;
  const nextAthlete = selectedAthlete ?? athletes.find((a) => a.status === "waiting") ?? null;

  // Queue selection — announce the athlete and make them the "up next" target
  // for the Group C difficulty box (does NOT start the match).
  function selectAthlete(a: Athlete) {
    setSelectedId(a.id);
    void callAthlete(a);
    pushLog("match", `🎯 اختيار: ${a.full_name}`);
  }

  // Unified call + start for the up-next athlete.
  async function callAndStart(a: Athlete) {
    await callAthlete(a);
    await startMatch(a);
  }

  // ── State machine: pre → live → post ─────────────────────────────
  const matchPhase: "pre" | "live" | "post" =
    !liveAthlete ? "pre"
    : timerRunning ? "live"
    : timer.timerSec > 0 ? "post"
    : "pre";
  const deductionsEnabled = matchPhase !== "pre";

  return (
    <div className="h-screen max-h-screen overflow-hidden p-2 md:p-3 relative font-arabic flex flex-col" dir="rtl">
      <div className="mesh-gradient-bg" />
      <div className="max-w-[1600px] w-full mx-auto relative z-10 flex flex-col gap-2 flex-1 min-h-0">

        {/* ===== STANDARDIZED HEADER ===== */}
        <motion.header
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          className="num-west glass-card rounded-xl px-3 py-2 border border-fed-blue/20 flex items-center justify-between gap-3 shrink-0"
        >
          <div className="flex items-center gap-3 min-w-0">
            <FederationLogo size="header" />
            <div className="border-r border-foreground/10 pr-3 min-w-0 hidden sm:block">
              <p className="text-[9px] uppercase tracking-widest text-fed-blue font-body leading-none">Technical Assistant</p>
              <h1 className="text-sm md:text-base font-heading font-bold text-gold leading-tight truncate">
                {tournament?.name ?? "إدارة البطولة"}
              </h1>
            </div>
            {tournament?.location && (
              <span className="hidden lg:inline-flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> {tournament.location}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* PROMINENT MODE TOGGLE — Compulsory / Optional.
                Big, color-coded buttons so the TA can flip the whole tournament
                in one tap and every Judge B / C screen rescales instantly. */}
            <div className="flex items-center rounded-lg border border-fed-blue/40 bg-background/60 overflow-hidden h-7">
              <button
                type="button"
                disabled={configLocked}
                onClick={() => !configLocked && setMatchMode("compulsory")}
                className={`px-3 h-full text-[11px] font-heading font-bold transition-all ${
                  matchMode === "compulsory"
                    ? "bg-green-500/25 text-green-300 shadow-[inset_0_0_10px_hsl(140_80%_50%/0.3)]"
                    : "text-muted-foreground hover:text-foreground"
                } disabled:opacity-50`}
                title="Compulsory · إلزامية (A 7 + B 3 = 10)"
              >
                إجبارية · COMP
              </button>
              <span className="w-px h-4 bg-fed-blue/40" />
              <button
                type="button"
                disabled={configLocked}
                onClick={() => !configLocked && setMatchMode("optional")}
                className={`px-3 h-full text-[11px] font-heading font-bold transition-all ${
                  matchMode === "optional"
                    ? "bg-orange-500/25 text-orange-300 shadow-[inset_0_0_10px_hsl(25_90%_55%/0.3)]"
                    : "text-muted-foreground hover:text-foreground"
                } disabled:opacity-50`}
                title="Optional · اختيارية (A 5 + B 3 + C 2 = 10)"
              >
                اختيارية · OPT
              </button>
            </div>
            <Select value={matchMode} onValueChange={(v) => !configLocked && setMatchMode(v as any)}>
              <SelectTrigger disabled={configLocked} className="h-7 w-[130px] text-xs bg-background/60 border-fed-blue/30 hidden md:flex">
                <SelectValue placeholder="Match Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compulsory">Compulsory (A+B)</SelectItem>
                <SelectItem value="optional">Optional (A+B+C)</SelectItem>
              </SelectContent>
            </Select>
            <Select value={timeRuleId} onValueChange={(v) => !configLocked && setTimeRuleId(v)}>
              <SelectTrigger disabled={configLocked} className="h-7 w-[190px] text-xs bg-background/60 border-fed-blue/30"
                title="فئة/أسلوب المنافسة — يضبط زمن الأداء والخصم التلقائي">
                <SelectValue placeholder="Category / Time" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_TIME_RULES.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.label} · {fmtRuleWindow(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={styleCategory} onValueChange={(v) => !configLocked && setStyleCategory(v as any)}>
              <SelectTrigger disabled={configLocked} className="h-7 w-[120px] text-xs bg-background/60 border-fed-blue/30">
                <SelectValue placeholder="Style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="changquan">Northern (CQ)</SelectItem>
                <SelectItem value="nanquan">Southern (NQ)</SelectItem>
                <SelectItem value="taijiquan">Taiji (TJQ)</SelectItem>
                <SelectItem value="traditional">Traditional</SelectItem>
              </SelectContent>
            </Select>
            <span className="hidden xl:inline-flex items-center px-2 h-7 rounded-lg border border-fed-blue/30 bg-background/60 text-[11px] font-bold text-fed-blue">
              {styleLabelAr(styleCategory)}
            </span>
            {!configLocked ? (
              <Button onClick={lockAndStart} size="sm" className="h-7 px-2 text-xs bg-gold text-navy hover:bg-gold/90 font-bold">
                <Lock className="h-3 w-3 ml-1" /> Lock
              </Button>
            ) : (
              <Button onClick={unlockConfig} size="sm" variant="outline" className="h-7 px-2 text-xs border-emerald-500/40 text-emerald-400">
                <Unlock className="h-3 w-3 ml-1" /> Locked
              </Button>
            )}
            <button onClick={copySession}
              className="group flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gold/10 border border-gold/40 hover:bg-gold/20 transition-all">
              <KeyRound className="h-3.5 w-3.5 text-gold" />
              <p className="font-mono text-sm font-bold text-gold tracking-widest leading-none">{sessionCode ?? "—"}</p>
              <Copy className="h-3 w-3 text-muted-foreground group-hover:text-gold" />
            </button>

            {/* Signal Chief — high-priority alert */}
            <Button onClick={signalChief} size="sm"
              className="h-7 px-2 text-xs bg-fed-red hover:bg-fed-red/90 text-white shadow shadow-fed-red/30 font-bold">
              <Megaphone className="h-3 w-3 ml-1" /> Signal Chief
            </Button>

            {/* Broadcast VAR — sends a video-review request to the VAR screen */}
            <Button onClick={broadcastVar} size="sm"
              className="h-7 px-2 text-xs bg-orange-500 hover:bg-orange-600 text-black shadow shadow-orange-500/30 font-bold">
              <Video className="h-3 w-3 ml-1" /> Broadcast VAR
            </Button>

            {/* View Session Logs — opens the Event Drawer */}
            <Button onClick={() => setDrawerOpen((v) => !v)} size="sm" variant="outline"
              className="h-7 px-2 text-xs border-fed-blue/40 text-fed-blue hover:bg-fed-blue/10">
              <Activity className="h-3 w-3 ml-1" /> View Logs ({eventLog.length})
            </Button>

            {/* Slide-over: Import + Settings (icon-only) */}
            <Sheet open={panelOpen} onOpenChange={setPanelOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-fed-blue" title="الاستيراد والإعدادات">
                  <Settings className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-full sm:max-w-xl overflow-y-auto" dir="rtl">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2 text-gold font-heading">
                    <Settings className="h-5 w-5" /> لوحة التحكم
                  </SheetTitle>
                </SheetHeader>
                <Tabs value={tab} onValueChange={setTab} className="w-full mt-4">
                  <TabsList className="grid grid-cols-2 w-full bg-card/40 backdrop-blur p-1 h-auto">
                    <TabsTrigger value="import" className="data-[state=active]:bg-fed-blue data-[state=active]:text-white py-2">
                      <FileSpreadsheet className="h-4 w-4 ml-1.5" /> استيراد
                    </TabsTrigger>
                    <TabsTrigger value="setup" className="data-[state=active]:bg-gold data-[state=active]:text-navy py-2">
                      <Settings className="h-4 w-4 ml-1.5" /> الإعدادات
                    </TabsTrigger>
                  </TabsList>

                  {/* ===== TAB: SETUP ===== */}
                  <TabsContent value="setup" className="mt-4">
                    <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="glass-card rounded-2xl p-4 space-y-4">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-gold" />
                        <h2 className="text-base font-heading font-bold">إعدادات البطولة</h2>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <Field label="اسم البطولة *">
                          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="البطولة الوطنية 2026" />
                        </Field>
                        <Field label="المكان" icon={<MapPin className="h-3 w-3" />}>
                          <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="تونس" />
                        </Field>
                        <Field label="تاريخ البداية (YYYY-MM-DD)" icon={<Calendar className="h-3 w-3" />}>
                          <Input type="text" inputMode="numeric" lang="en-GB" dir="ltr"
                            placeholder="YYYY-MM-DD" pattern="\d{4}-\d{2}-\d{2}" maxLength={10}
                            value={form.start_date}
                            onChange={(e) => setForm({ ...form, start_date: toWesternDigits(e.target.value) })} />
                        </Field>
                        <Field label="تاريخ النهاية (YYYY-MM-DD)" icon={<Calendar className="h-3 w-3" />}>
                          <Input type="text" inputMode="numeric" lang="en-GB" dir="ltr"
                            placeholder="YYYY-MM-DD" pattern="\d{4}-\d{2}-\d{2}" maxLength={10}
                            value={form.end_date}
                            onChange={(e) => setForm({ ...form, end_date: toWesternDigits(e.target.value) })} />
                        </Field>

                      </div>
                      <div className="flex justify-end pt-2">
                        <Button onClick={saveTournament} disabled={saving}
                          className="bg-gold text-navy hover:bg-gold/90 font-bold">
                          {tournament ? "تحديث البطولة" : "إنشاء البطولة"}
                        </Button>
                      </div>
{/* ===== Export / Webhook settings ===== */}
                    <div className="border-t border-border/40 pt-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Radio className="h-4 w-4 text-fed-blue" />
                          <h3 className="text-sm font-heading font-bold">تصدير النتائج · Webhook</h3>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const next = { ...webhook, enabled: !webhook.enabled };
                            setWebhook(next); 
                            saveWebhookSettings(sessionCode, next);
                          }}
                          className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-all ${
                            webhook.enabled
                              ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                              : "border-border bg-muted/30 text-muted-foreground"
                          }`}
                        >
                          {webhook.enabled ? "مفعّل · ON" : "معطّل · OFF"}
                        </button>
                      </div>
                      <Field label="عنوان الـ Webhook (HTTPS)">
                        <Input
                          dir="ltr"
                          value={webhook.url}
                          onChange={(e) => setWebhook({ ...webhook, url: e.target.value })}
                          placeholder="https://federation.example.tn/api/live-results"
                        />
                      </Field>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          يُرسل JSON عند نشر النتيجة النهائية: tournamentId, athleteName, team, style,
                          difficultyScore, deductionScore, finalScore, timestamp
                        </p>
                        <Button
                          size="sm" 
                          variant="outline"
                          className="shrink-0 border-fed-blue/40 text-fed-blue hover:bg-fed-blue/10"
                          onClick={() => {
                            if (webhook.url && !isValidWebhookUrl(webhook.url)) {
                              toast.error("عنوان غير صالح — استعمل http(s)://");
                              return;
                            }
                            saveWebhookSettings(sessionCode, webhook);
                            toast.success("تم حفظ إعدادات التصدير");
                          }}
                        >
                          حفظ
                        </Button>
                      </div>
                    </div>
                  </motion.section>

                </TabsContent>

                {/* ===== TAB: IMPORT ===== */}
                <TabsContent value="import" className="mt-4">
                  <motion.section 
                    initial={{ opacity: 0, y: 8 }} 
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card rounded-2xl p-4 space-y-4"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-5 w-5 text-fed-blue" />
                        <h2 className="text-base font-heading font-bold">استيراد اللاعبين</h2>
                      </div>
                      <Button onClick={downloadTemplate} variant="outline" size="sm" className="border-gold/40 text-gold hover:bg-gold/10">
                        <Download className="h-4 w-4 ml-1" /> النموذج
                      </Button>
                    </div>

                    <div
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault(); 
                        setDragOver(false);
                        const f = e.dataTransfer.files?.[0]; 
                        if (f) void processFile(f);
                      }}
                      onClick={() => fileRef.current?.click()}
                      className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all p-8 text-center
                        ${dragOver ? "border-fed-blue bg-fed-blue/10 scale-[1.01]" : "border-border/60 hover:border-fed-blue/60 hover:bg-fed-blue/5"}
                        ${!tournament ? "opacity-50 pointer-events-none" : ""}`}
                    >
                      <input 
                        ref={fileRef} 
                        type="file" 
                        accept=".csv,.xlsx,.xls"
                        onChange={(e) => { 
                          const f = e.target.files?.[0]; 
                          if (f) void processFile(f); 
                          e.target.value = ""; 
                        }}
                        className="hidden" 
                      />
                      <motion.div animate={{ y: dragOver ? -4 : 0 }} className="flex flex-col items-center gap-3">
                        <div className="h-14 w-14 rounded-2xl bg-fed-blue/10 border border-fed-blue/30 flex items-center justify-center">
                          <Upload className="h-6 w-6 text-fed-blue" />
                        </div>
                        <div>
                          <p className="font-heading font-bold">اسحب وأفلت ملف CSV أو Excel هنا</p>
                          <p className="text-xs text-muted-foreground mt-1">أو انقر لاختيار ملف</p>
                        </div>
                        {!tournament && <p className="text-xs text-fed-red">⚠ أنشئ البطولة أولاً من الإعدادات</p>}
                      </motion.div>
                    </div>

                    <div className="text-xs text-muted-foreground bg-muted/20 rounded-lg p-3 leading-relaxed">
                      <strong className="text-foreground">الأعمدة المتوقعة:</strong>{" "}
                      <span className="font-mono">number, name, gender, birth_date, club, country, difficulty_codes</span>
                    </div>

                    <AnimatePresence>
                      {preview && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }} 
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }} 
                          className="space-y-3"
                        >
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <FileCheck2 className="h-5 w-5 text-emerald-400" />
                              <h3 className="font-heading font-bold">معاينة ({preview.length})</h3>
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>
                                <X className="h-4 w-4 ml-1" /> إلغاء
                              </Button>
                              <Button 
                                size="sm" 
                                onClick={confirmImport} 
                                disabled={saving}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white"
                              >
                                <CheckCircle2 className="h-4 w-4 ml-1" /> تأكيد
                              </Button>
                            </div>
                          </div>
                          <div className="num-west overflow-x-auto rounded-lg border border-border/50 max-h-72">
                            <table className="w-full text-xs">
                              <thead className="bg-muted/30 sticky top-0">
                                <tr>
                                  <th className="p-2 text-right">#</th>
                                  <th className="p-2 text-right">الاسم</th>
                                  <th className="p-2 text-right">الفئة</th>
                                  <th className="p-2 text-right">النادي</th>
                                  <th className="p-2 text-right">حركات الصعوبة</th>
                                </tr>
                              </thead>
                              <tbody>
                                {preview.slice(0, 50).map((r, i) => (
                                  <tr key={i} className="border-t border-border/40">
                                    <td className="p-2 font-mono text-gold">{r.bib_number ?? "—"}</td>
                                    <td className="p-2 font-semibold">{r.full_name}</td>
                                    <td className="p-2">
                                      {r.age_category && <Badge variant="outline" className={AGE_CATEGORY_COLORS[r.age_category as AgeCategory]}>{r.age_category}</Badge>}
                                    </td>
                                    <td className="p-2 text-muted-foreground">{r.club ?? "—"}</td>
                                    <td className="p-2 font-mono">
                                      {r.difficulty_sheet?.length
                                        ? <span className="text-emerald-400">{r.difficulty_sheet.length}</span>
                                        : <span className="text-muted-foreground">0</span>}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {preview.length > 50 && <p className="text-center text-xs text-muted-foreground p-2">... و {preview.length - 50} لاعب آخر</p>}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.section>
                </TabsContent>
              </Tabs>
            </SheetContent>
          </Sheet>

          {/* Disconnect moved to icon-only to free header space */}
          <Button variant="ghost" size="icon" onClick={disconnect} className="h-7 w-7 text-muted-foreground" title="قطع الاتصال بالجلسة">
            <LogIn className="h-4 w-4 rotate-180" />
          </Button>
          <Button variant="ghost" size="sm" onClick={logout} className="h-7 px-2 text-xs">
            <LogOut className="h-3 w-3 ml-1" /> خروج
          </Button>
        </div>
      </motion.header>

      {/* ===== FIXED TOP BAR: Timer | OOB | Sync + Athlete Call ===== */}
      <motion.section 
        initial={{ opacity: 0, y: 8 }} 
        animate={{ opacity: 1, y: 0 }}
        className="num-west rounded-2xl p-3 grid grid-cols-12 gap-3 border border-foreground/10 shrink-0"
        style={{ background: "#000" }}
      >
        {/* Official Timer — Phase-aware (PRE / LIVE / POST) */}
        <motion.div
          animate={{
            borderColor:
              matchPhase === "live" ? "rgba(34,197,94,0.6)" :
              matchPhase === "post" ? "rgba(251,146,60,0.5)" :
              "rgba(255,255,255,0.15)",
            boxShadow: matchPhase === "live" ? "0 0 24px rgba(34,197,94,0.25)" : "none",
          }}
          transition={{ duration: 0.4 }}
          className="col-span-12 md:col-span-4 rounded-xl p-3 border-2 bg-black"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Timer className={`h-3.5 w-3.5 ${matchPhase === "live" ? "text-emerald-400" : "text-orange-400"}`} />
              <p className={`text-[10px] uppercase tracking-widest font-bold ${matchPhase === "live" ? "text-emerald-400" : "text-orange-400"}`}>
                Timer
              </p>
              <span className={`ml-1 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                matchPhase === "live" ? "bg-emerald-500/20 text-emerald-300 animate-pulse" :
                matchPhase === "post" ? "bg-orange-500/20 text-orange-300" :
                "bg-muted/30 text-muted-foreground"
              }`}>
                {matchPhase === "pre" ? "PRE-MATCH" : matchPhase === "live" ? "● LIVE" : "POST-MATCH"}
              </span>
            </div>
            {liveAthlete && <span className="text-[10px] text-emerald-400 truncate max-w-[120px]">{liveAthlete.full_name}</span>}
          </div>
          <p className={`text-3xl font-heading font-black tabular-nums text-center ${timerRunning ? "text-orange-400 drop-shadow-[0_0_12px_rgba(251,146,60,0.6)]" : "text-white"}`} dir="ltr">
            {fmt(timer.timerSec)}
          </p>
          {/* IWUF required-window hint + live auto-deduction */}
          {(() => {
            const rule = getCategoryRule(timeRuleId);
            const td = !timerRunning && timer.timerSec > 0 ? checkCategoryTime(timeRuleId, timer.timerSec) : null;
            return (
              <div className="flex items-center justify-between gap-2 text-[9px] mt-1">
                <span className="text-white/50" dir="ltr">Required: {fmtRuleWindow(rule)}</span>
                {td && td.value > 0 ? (
                  <span className="px-1.5 py-0.5 rounded font-bold bg-fed-red/20 text-fed-red border border-fed-red/40" dir="ltr">
                    Time −{td.value.toFixed(2)}
                  </span>
                ) : timer.timerSec > 0 && !timerRunning ? (
                  <span className="px-1.5 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" dir="ltr">
                    ✓ In window
                  </span>
                ) : null}
              </div>
            );
          })()}

          <div className="flex gap-1.5 mt-2">
            {!timerRunning ? (
              <Button type="button" onClick={() => void timerStart()} size="sm" className="flex-1 h-8 bg-emerald-500 hover:bg-emerald-600 text-white">
                <Play className="h-3 w-3 ml-1" /> Start
              </Button>
            ) : (
              <Button type="button" onClick={() => void timerStop()} size="sm" className="flex-1 h-8 bg-orange-500 hover:bg-orange-600 text-white">
                <Pause className="h-3 w-3 ml-1" /> Stop
              </Button>
            )}
            <Button type="button" onClick={() => void timerReset()} size="sm" variant="outline" className="h-8 px-2 border-white/20 text-white hover:bg-white/10">
              <RotateCcw className="h-3 w-3" />
            </Button>
          </div>
        </motion.div>

        {/* OOB +/- Stepper — interactive, phase-locked, large hit-targets */}
        <div className={`relative z-10 col-span-12 md:col-span-4 rounded-xl p-4 border bg-black transition-all ${
          deductionsEnabled ? "border-fed-red/40" : "border-white/10 opacity-60"
        }`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className={`h-4 w-4 ${deductionsEnabled ? "text-fed-red" : "text-muted-foreground"}`} />
              <p className={`text-[11px] uppercase tracking-widest font-bold ${deductionsEnabled ? "text-fed-red" : "text-muted-foreground"}`}>
                Out of Bounds
              </p>
              {/* Phase indicator */}
              <span className={`ml-1 text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                matchPhase === "live" ? "bg-emerald-500/20 text-emerald-300 animate-pulse" :
                matchPhase === "post" ? "bg-orange-500/20 text-orange-300" :
                "bg-muted/30 text-muted-foreground"
              }`}>
                {matchPhase.toUpperCase()}
              </span>
            </div>
            <motion.span
              key={oobPulse}
              initial={{ scale: 1.4, color: "rgb(248 113 113)" }}
              animate={{ scale: 1, color: "rgb(248 113 113 / 0.8)" }}
              transition={{ duration: 0.4 }}
              className="text-xs font-bold"
            >
              −{(timer.oobPoints * 0.1).toFixed(1)} pts
            </motion.span>
          </div>
          <div className="flex items-center justify-center gap-3 select-none">
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={(e) => { e.stopPropagation(); void adjustOob(-1); }}
              disabled={!deductionsEnabled || timer.oobPoints === 0}
              className="relative z-20 h-14 w-14 rounded-2xl bg-fed-red/15 hover:bg-fed-red/30 active:bg-fed-red/40 border-2 border-fed-red/40 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center text-fed-red transition-colors cursor-pointer"
              aria-label="Decrease OOB"
            >
              <Minus className="h-6 w-6 pointer-events-none" />
            </motion.button>

            <div className="flex-1 text-center">
              <motion.p
                key={`oob-${timer.oobPoints}`}
                initial={{ scale: 1.3, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 18 }}
                className="text-4xl font-heading font-black text-fed-red tabular-nums leading-none"
              >
                {timer.oobPoints}
              </motion.p>
              <p className="text-[10px] text-muted-foreground mt-1">events</p>
            </div>

            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={(e) => { e.stopPropagation(); void adjustOob(+1); }}
              disabled={!deductionsEnabled}
              className="relative z-20 h-14 w-14 rounded-2xl bg-fed-red/15 hover:bg-fed-red/30 active:bg-fed-red/40 border-2 border-fed-red/40 disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center text-fed-red transition-colors cursor-pointer"
              aria-label="Increase OOB"
            >
              <Plus className="h-6 w-6 pointer-events-none" />
            </motion.button>
          </div>
          {!deductionsEnabled && (
            <p className="text-[10px] text-center text-muted-foreground mt-2 italic">
              ⏯ ابدأ المؤقت لتفعيل الخصومات · Start timer to enable
            </p>
          )}

          {/* Live event log (compact) */}
          <div className="mt-2 border-t border-white/10 pt-1.5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[9px] uppercase tracking-widest font-bold text-white/50" dir="ltr">Live Log</p>
              <button onClick={() => setDrawerOpen(true)} className="text-[9px] text-fed-blue hover:underline">
                الكل ({eventLog.length})
              </button>
            </div>
            <div className="h-[74px] overflow-y-auto space-y-0.5 pr-1">
              {eventLog.length === 0 ? (
                <p className="text-[10px] text-muted-foreground italic text-center py-3">لا توجد أحداث بعد</p>
              ) : eventLog.slice(0, 12).map((e, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="text-white/70 truncate">{e.label}</span>
                  <span className="text-white/35 font-mono shrink-0 num-west">{fmtClock(e.ts)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Athlete Call Box — bound to LIVE athlete (master state) */}
        <div className="col-span-12 md:col-span-4 rounded-xl p-3 border border-gold/40 bg-gradient-to-br from-fed-blue/10 to-black flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest font-bold text-gold flex items-center gap-1">
              <Megaphone className="h-3 w-3" /> Athlete Call
            </p>
            <Button 
              onClick={syncWithChief} 
              size="sm" 
              variant="ghost"
              className="h-6 px-2 text-[10px] text-fed-blue hover:bg-fed-blue/10"
            >
              <Zap className="h-3 w-3 ml-1" /> Sync
            </Button>
          </div>

          {liveAthlete ? (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/5">
              {/* Avatar placeholder (initials) */}
              <div className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-gold/30 to-fed-blue/30 border border-gold/50 flex items-center justify-center text-gold font-heading font-black text-sm">
                {liveAthlete.full_name.split(" ").map(p => p[0]).slice(0, 2).join("")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">LIVE</span>
                  <p className="text-[10px] text-gold font-mono">#{liveAthlete.bib_number ?? "—"}</p>
                </div>
                <p className="text-xs font-bold text-white truncate leading-tight">{liveAthlete.full_name}</p>
                <p className="text-[10px] text-muted-foreground truncate leading-tight">
                  {liveAthlete.club ?? "—"} · {liveAthlete.country ?? "—"}
                </p>
              </div>
            </div>
          ) : nextAthlete ? (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-fed-blue/30 bg-fed-blue/5">
              <div className="h-11 w-11 shrink-0 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 font-heading font-black text-sm">
                {nextAthlete.full_name.split(" ").map(p => p[0]).slice(0, 2).join("")}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] text-muted-foreground leading-none">القادم · Up Next</p>
                <p className="text-xs font-bold text-white truncate">{nextAthlete.full_name}</p>
                <p className="text-[10px] text-gold font-mono">#{nextAthlete.bib_number ?? "—"} · {nextAthlete.club ?? "—"}</p>
              </div>
              <Button 
                onClick={() => void callAndStart(nextAthlete)} 
                size="sm"
                className="h-8 px-3 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold"
              >
                <Megaphone className="h-3 w-3 ml-1" /> نداء / ابدأ
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">لا يوجد لاعب نشط أو قادم</p>
          )}

          {/* GLOBAL RESET — wipes all connected screens */}
          <Button
            onClick={nextAthleteGlobalReset}
            className="w-full h-10 mt-1 bg-gradient-to-r from-orange-600 to-red-600 hover:brightness-110 text-white font-heading font-black text-xs tracking-wider"
            style={{ boxShadow: "0 6px 20px rgba(255,80,40,0.45)" }}
          >
            <RotateCcw className="h-3.5 w-3.5 ml-1" />
            NEXT ATHLETE — GLOBAL RESET · اللاعب التالي
          </Button>
        </div>
      </motion.section>

      {/* ===== SCROLLABLE WORKSPACE (page itself never scrolls) ===== */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 pl-1">

        {/* ===== DYNAMIC JUDGES MANAGEMENT (team size +/-) ===== */}
        <div className="shrink-0">
          <TeamSizeControls team={team} onChange={setTeamConfig} />
        </div>

        {/* ===== HORIZONTAL JUDGES MONITOR (full-width) ===== */}
        <div className="shrink-0">
          <JudgesStatusGrid statuses={judgeStatuses} liveAthleteName={liveAthlete?.full_name ?? null} team={team} />
        </div>

        {/* ===== DIFFICULTY MANAGER — Black Box for Group C ===== */}
        <DifficultyManager
          sessionCode={sessionCode}
          targetAthlete={liveAthlete ?? nextAthlete ?? null}
          isLive={Boolean(liveAthlete)}
          judgeStatuses={judgeStatuses}
          onSaved={() => { void loadActive(); }}
        />

        {/* Event log lives in a floating Sheet triggered by the header "View Logs" button */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="right" className="num-west w-full sm:max-w-md" dir="rtl">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 text-fed-blue font-heading">
                <Activity className="h-5 w-5" /> سجل الأحداث ({eventLog.length})
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-1 overflow-y-auto max-h-[80vh] pr-1">
              {eventLog.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-6">لا توجد أحداث بعد</p>
              ) : eventLog.map((e, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-white/5">
                  <span className="text-white/80 truncate">{e.label}</span>
                  <span className="text-muted-foreground font-mono shrink-0">{fmtClock(e.ts)}</span>
                </div>
              ))}
            </div>
            {eventLog.length > 0 && (
              <button onClick={() => setEventLog([])} className="text-xs text-fed-red hover:underline mt-2">مسح السجل</button>
            )}
          </SheetContent>
        </Sheet>

        {/* ===== MAIN WORKSPACE: MATCH MANAGEMENT ===== */}
        <motion.section 
          initial={{ opacity: 0, y: 8 }} 
          animate={{ opacity: 1, y: 0 }}
          className="num-west glass-card rounded-xl p-3 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between flex-wrap gap-2 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Play className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-heading font-bold">إدارة المباريات</h2>
              </div>
              <div className="flex gap-1.5 text-[11px]">
                <span className="px-2 py-0.5 rounded bg-muted/30">الإجمالي: <b className="text-foreground">{stats.total}</b></span>
                <span className="px-2 py-0.5 rounded bg-muted/30">انتظار: <b className="text-muted-foreground">{stats.waiting ?? 0}</b></span>
                <span className="px-2 py-0.5 rounded bg-fed-blue/15">جاري: <b className="text-fed-blue">{stats.judging ?? 0}</b></span>
              </div>
              {unsynced.length > 0 && (
                <button 
                  type="button" 
                  disabled={retrying}
                  onClick={() => void syncRecords(unsynced)}
                  className="px-2 py-0.5 rounded text-[11px] border border-amber-500/50 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 disabled:opacity-50"
                >
                  {unsynced.length} لاعبين محليين — {retrying ? "جاري إعادة المحاولة…" : "إعادة المحاولة"}
                </button>
              )}
            </div>

            <div className="flex gap-2 items-center flex-wrap">
              <Button 
                onClick={() => setManualOpen(true)} 
                size="sm" 
                disabled={!tournament}
                className="h-8 bg-emerald-500 hover:bg-emerald-600 text-white shadow shadow-emerald-500/20"
              >
                <UserPlus className="h-3.5 w-3.5 ml-1" /> إضافة يدوية
              </Button>
              <div className="relative">
                <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input 
                  className="pr-8 h-8 w-40 md:w-52 text-xs" 
                  placeholder="بحث..."
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                />
              </div>
              <select 
                value={filter} 
                onChange={(e) => setFilter(e.target.value as any)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="all">كل الفئات</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {athletes.length > 0 && (
                <Button onClick={clearAll} variant="ghost" size="sm" className="h-8 text-fed-red hover:text-fed-red hover:bg-fed-red/10">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          <div className="pr-1">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                {athletes.length === 0
                  ? (tournament ? "لا يوجد لاعبون. افتح لوحة الاستيراد لرفع ملف." : "أنشئ البطولة أولاً من لوحة الإعدادات.")
                  : "لا توجد نتائج مطابقة."}
              </div>
            ) : (
              <div className="hidden md:block rounded-xl border border-border/50">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 text-xs sticky top-0 z-10">
                    <tr>
                      <th className="p-2.5 text-right">الرقم</th>
                      <th className="p-2.5 text-right">الاسم</th>
                      <th className="p-2.5 text-right">الفئة</th>
                      <th className="p-2.5 text-right">النادي</th>
                      <th className="p-2.5 text-right">الدولة</th>
                      <th className="p-2.5 text-right">الحالة</th>
                      <th className="p-2.5 text-right">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((a) => {
                      const meta = STATUS_META[a.status];
                      const Icon = meta.icon;
                      const cat = a.age_category as AgeCategory | null;
                      const isLive = a.status === "judging";
                      return (
                        <tr 
                          key={a.id}
                          className={`border-t border-border/40 transition-colors ${isLive ? "bg-fed-blue/10 animate-pulse-row" : "hover:bg-muted/10"}`}
                        >
                          <td className="p-2.5 font-mono font-bold text-gold">{a.bib_number ?? "—"}</td>
                          <td className="p-2.5 font-semibold">{a.full_name}</td>
                          <td className="p-2.5">{cat ? <Badge variant="outline" className={AGE_CATEGORY_COLORS[cat]}>{cat}</Badge> : "—"}</td>
                          <td className="p-2.5 text-muted-foreground">{a.club ?? "—"}</td>
                          <td className="p-2.5 text-muted-foreground">{a.country ?? "—"}</td>
                          <td className="p-2.5">
                            <Badge variant="outline" className={meta.cls}>
                              <Icon className={`h-3 w-3 ml-1 ${isLive ? "animate-spin" : ""}`} /> {meta.label}
                            </Badge>
                          </td>
                          <td className="p-2.5">
                            <ActionButtons a={a} onFinish={finishMatch} onDelete={deleteAthlete} onSelect={selectAthlete} isSelected={selectedId === a.id} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.section>
      </div>

             <div className="md:hidden space-y-2">
                      {filtered.map((a) => {
                        const meta = STATUS_META[a.status];
                        const Icon = meta.icon;
                        const cat = a.age_category as AgeCategory | null;
                        const isLive = a.status === "judging";
                        return (
                          <div key={a.id}
                            className={`rounded-xl border p-3 space-y-2 ${isLive ? "bg-fed-blue/10 border-fed-blue/40 animate-pulse-row" : "border-border/40 bg-card/40"}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-gold text-lg">{a.bib_number ?? "—"}</span>
                                <span className="font-semibold">{a.full_name}</span>
                              </div>
                              <Badge variant="outline" className={meta.cls}>
                                <Icon className={`h-3 w-3 ml-1 ${isLive ? "animate-spin" : ""}`} /> {meta.label}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-muted-foreground">
                              {cat && <Badge variant="outline" className={AGE_CATEGORY_COLORS[cat]}>{cat}</Badge>}
                              <span>{a.club ?? "—"} · {a.country ?? "—"}</span>
                            </div>
                            <ActionButtons a={a} onFinish={finishMatch} onDelete={deleteAthlete} onSelect={selectAthlete} isSelected={selectedId === a.id} />
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </motion.section>
            </div>
          </div>

          <style>{`
            @keyframes pulse-row {
              0%, 100% { box-shadow: inset 0 0 0 1px hsl(var(--fed-blue) / 0.4); }
              50% { box-shadow: inset 0 0 0 2px hsl(var(--fed-blue) / 0.8), 0 0 20px hsl(var(--fed-blue) / 0.3); }
            }
            .animate-pulse-row { animation: pulse-row 2s ease-in-out infinite; }
            /* Western (Latin) digits everywhere — never Eastern-Arabic numerals */
            .num-west, .num-west * {
              font-variant-numeric: tabular-nums lining-nums;
              font-feature-settings: "tnum" 1, "lnum" 1;
              unicode-bidi: plaintext;
            }
          `}</style>

          {/* ===== MANUAL ADD ATHLETE DIALOG ===== */}
          <Dialog open={manualOpen} onOpenChange={setManualOpen}>
            <DialogContent className="num-west sm:max-w-lg" dir="rtl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-gold">
                  <UserPlus className="h-5 w-5" /> إضافة لاعب يدوياً
                </DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 py-2">
                <Field label="الرقم (Bib)">
                  <Input value={manualForm.bib} onChange={(e) => setManualForm({ ...manualForm, bib: e.target.value })} placeholder="001" />
                </Field>
                <Field label="الجنس">
                  <select value={manualForm.gender} onChange={(e) => setManualForm({ ...manualForm, gender: e.target.value })}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                    <option value="">—</option>
                    <option value="M">ذكر</option>
                    <option value="F">أنثى</option>
                  </select>
                </Field>
                <div className="col-span-2">
                  <Field label="الاسم الكامل *">
                    <Input value={manualForm.name} onChange={(e) => setManualForm({ ...manualForm, name: e.target.value })} placeholder="محمد بن علي" autoFocus />
                  </Field>
                </div>
                <Field label="النادي">
                  <Input value={manualForm.club} onChange={(e) => setManualForm({ ...manualForm, club: e.target.value })} placeholder="نادي قرطاج" />
                </Field>
                <Field label="الدولة">
                  <Input value={manualForm.country} onChange={(e) => setManualForm({ ...manualForm, country: e.target.value })} placeholder="Tunisia" />
                </Field>
                <Field label="تاريخ الميلاد">
                  <Input type="date" {...dateInputProps} value={manualForm.birth_date} onChange={(e) => setManualForm({ ...manualForm, birth_date: e.target.value })} />
                </Field>
                <Field label="الفئة العمرية">
                  <select value={manualForm.category} onChange={(e) => setManualForm({ ...manualForm, category: e.target.value as AgeCategory | "" })}
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                    <option value="">تلقائي حسب التاريخ</option>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="ghost" onClick={() => setManualOpen(false)}>إلغاء</Button>
                <Button onClick={saveManualAthlete} disabled={manualSaving || !manualForm.name.trim()}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white">
                  {manualSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4 ml-1" /> حفظ ومزامنة</>}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      );
    }

    // ============ Judges Status Grid (compact dots) ============
    function JudgesStatusGrid({ statuses, liveAthleteName, team }: {
      statuses: JudgeStatusRow[];
      liveAthleteName: string | null;
      team: { numA: number; numB: number; numC: number };
    }) {
      const expected: { group: string; slots: string[]; color: string }[] = [
        { group: "A", slots: Array.from({ length: team.numA }, (_, i) => `A${i + 1}`), color: "text-emerald-400" },
        { group: "B", slots: Array.from({ length: team.numB }, (_, i) => `B${i + 1}`), color: "text-orange-400" },
        { group: "C", slots: Array.from({ length: team.numC }, (_, i) => `C${i + 1}`), color: "text-fed-red" },
        { group: "AHJ", slots: ["AHJ1"], color: "text-fed-blue" },
      ];
      const map = new Map(statuses.map((s) => [s.judge_slot, s.state]));

      return (
        <div className="rounded-2xl p-3 border border-fed-blue/30 bg-black h-full">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
            <div className="flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5 text-fed-blue animate-pulse" />
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-fed-blue">Judges Monitor</h3>
            </div>
            {liveAthleteName && (
              <span className="text-[10px] text-emerald-400 font-mono truncate max-w-[180px]">● {liveAthleteName}</span>
            )}
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
            {expected.map((g) => (
              <div key={g.group} className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 min-w-[88px]">
                <p className={`text-[10px] font-bold mb-1 ${g.color}`}>Group {g.group}</p>
                <div className="flex gap-1.5 flex-wrap">
                  {g.slots.length === 0 ? (
                    <span className="text-[9px] text-muted-foreground italic">—</span>
                  ) : g.slots.map((slot) => {
                    const state = map.get(slot);
                    const dotCls = !state
                      ? "bg-fed-red/30 border-fed-red/60"
                      : state === "sent"
                      ? "bg-emerald-500 border-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.7)]"
                      : "bg-emerald-500/40 border-emerald-400/60 animate-pulse";
                    return (
                      <div key={slot} className="flex items-center gap-1">
                        <span className={`h-2.5 w-2.5 rounded-full border ${dotCls}`} />
                        <span className="text-[10px] font-mono text-white/80">{slot}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/5 text-[9px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Sent</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500/40 animate-pulse" /> Judging</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-fed-red/40 border border-fed-red/60" /> Offline</span>
          </div>
        </div>
      );
    }

    // ============ Team Size Controls (Dynamic Judges Management) ============
    function TeamSizeControls({
      team,
      onChange,
    }: {
      team: { numA: number; numB: number; numC: number };
      onChange: (cfg: { numA: number; numB: number; numC: number }) => void;
    }) {
      const update = (key: "numA" | "numB" | "numC", delta: number) => {
        const next = Math.max(1, Math.min(5, team[key] + delta));
        if (next === team[key]) return;
        onChange({ ...team, [key]: next });
      };

      const Row = ({ k, label, color }: { k: "numA" | "numB" | "numC"; label: string; color: string }) => (
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 shrink-0">
          <span className={`text-[10px] font-bold uppercase tracking-wider ${color} min-w-[58px]`}>{label}</span>
          <button
            type="button"
            onClick={() => update(k, -1)}
            disabled={team[k] <= 1}
            className="h-6 w-6 rounded-md border border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
            aria-label={`decrease ${label}`}
          >
            <Minus className="h-3 w-3" />
          </button>
          <span className="text-base font-heading font-black tabular-nums text-amber-400 w-6 text-center" dir="ltr">
            {team[k]}
          </span>
          <button
            type="button"
            onClick={() => update(k, +1)}
            disabled={team[k] >= 5}
            className="h-6 w-6 rounded-md border border-white/10 bg-white/5 text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center"
            aria-label={`increase ${label}`}
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      );

      return (
        <div className="rounded-2xl p-2.5 border border-amber-400/30 bg-black/60 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 shrink-0">
            <Users className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-amber-400">Team Size · عدد القضاة</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Row k="numA" label="Group A" color="text-emerald-400" />
            <Row k="numB" label="Group B" color="text-orange-400" />
            <Row k="numC" label="Group C" color="text-fed-red" />
          </div>
          <span className="text-[9px] text-white/40 ml-auto">Range 1–5 · Trim high/low only when ≥5</span>
        </div>
      );
    }

    // ============ Event Drawer (collapsible match log) ============
    function EventDrawer({ log, open, onOpenChange, onClear }: {
      log: { ts: number; type: string; label: string }[];
      open: boolean;
      onOpenChange: (v: boolean) => void;
      onClear: () => void;
    }) {
      return (
        <Collapsible open={open} onOpenChange={onOpenChange}
          className="rounded-2xl border border-fed-blue/30 bg-black h-full flex flex-col">
          <CollapsibleTrigger className="flex items-center justify-between p-3 w-full hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-fed-blue" />
              <h3 className="text-[10px] uppercase tracking-widest font-bold text-fed-blue">Event Drawer</h3>
              <span className="text-[10px] text-muted-foreground">({log.length})</span>
            </div>
            {open ? <ChevronUp className="h-3.5 w-3.5 text-fed-blue" /> : <ChevronDown className="h-3.5 w-3.5 text-fed-blue" />}
          </CollapsibleTrigger>
          {!open && log[0] && (
            <p className="px-3 pb-3 text-[10px] text-muted-foreground truncate">
              آخر حدث: <span className="text-white">{log[0].label}</span>
            </p>
          )}
          <CollapsibleContent className="px-3 pb-3 flex-1 min-h-0">
            <div className="max-h-40 overflow-y-auto space-y-1 mt-1 pr-1">
              {log.length === 0 ? (
                <p className="text-[10px] text-muted-foreground italic text-center py-3">لا توجد أحداث بعد</p>
              ) : log.map((e, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-[10px] py-1 border-b border-white/5">
                  <span className="text-white/80 truncate">{e.label}</span>
                  <span className="text-muted-foreground font-mono shrink-0">{fmtClock(e.ts)}</span>
                </div>
              ))}
            </div>
            {log.length > 0 && (
              <button onClick={onClear} className="text-[10px] text-fed-red hover:underline mt-1">مسح السجل</button>
            )}
          </CollapsibleContent>
        </Collapsible>
      );
    }

    // ============ Sub-components ============
    function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
      return (
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">{icon} {label}</Label>
          {children}
        </div>
      );
    }

    function SummaryPill({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
      return (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-background/40 border border-border/40">
          <div className={`${accent}`}>{icon}</div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground leading-none">{label}</p>
            <p className={`text-sm font-bold truncate ${accent}`}>{value}</p>
          </div>
        </div>
      );
    }

    function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
      return (
        <div className="glass-card rounded-xl p-3 flex items-center gap-3">
          <div className={`h-10 w-10 rounded-lg bg-foreground/5 flex items-center justify-center ${color}`}>{icon}</div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-heading font-bold ${color}`}>{value}</p>
          </div>
        </div>
      );
    }

    function ActionButtons({ a, onFinish, onDelete, onSelect, isSelected }: {
      a: Athlete;
      onFinish: (a: Athlete) => void;
      onDelete: (id: string) => void;
      onSelect: (a: Athlete) => void;
      isSelected: boolean;
    }) {
      return (
        <div className="flex gap-1.5 flex-wrap">
          {a.status !== "judging" && (
            <Button size="sm" variant={isSelected ? "default" : "outline"} onClick={() => onSelect(a)}
              className={isSelected
                ? "h-8 bg-fed-blue hover:bg-fed-blue/90 text-white"
                : "h-8 border-fed-blue/40 text-fed-blue hover:bg-fed-blue/10"}>
              <Megaphone className="h-3.5 w-3.5 ml-1" /> اختيار / Select
            </Button>
          )}
          {a.status === "judging" && (
            <Button size="sm" onClick={() => onFinish(a)}
              className="h-8 bg-fed-blue hover:bg-fed-blue/90 text-white shadow-md shadow-fed-blue/30">
              <CheckCircle2 className="h-3.5 w-3.5 ml-1" /> إنهاء
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => onDelete(a.id)}
            className="h-8 text-fed-red hover:text-fed-red hover:bg-fed-red/10">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      );
    }

    // ============================================================================
    // DIFFICULTY MANAGER — Black Box for Group C
    // ============================================================================
    function DifficultyManager({
      sessionCode,
      targetAthlete,
      isLive,
      judgeStatuses,
      onSaved,
    }: {
      sessionCode: string;
      targetAthlete: Athlete | null;
      isLive: boolean;
      judgeStatuses: JudgeStatusRow[];
      onSaved?: () => void;
    }) {
      const [codesInput, setCodesInput] = useState("");
      const [parsedItems, setParsedItems] = useState<{ code: string; pts: number }[]>([]);
      const [saving, setSaving] = useState(false);

      useEffect(() => {
        if (targetAthlete?.difficulty_sheet) {
          const codes = targetAthlete.difficulty_sheet.map((item: any) => item.code ?? item).join(" ");
          setCodesInput(codes);
        } else {
          setCodesInput("");
        }
      }, [targetAthlete]);

      useEffect(() => {
        const tokens = codesInput.trim().split(/\s+/).filter(Boolean);
        const items = tokens.map((code) => {
          const matched = typeof (IWUF_DIFFICULTY_TABLE as any) !== "undefined" ? (IWUF_DIFFICULTY_TABLE as any)[code] : null;
          return { code, pts: matched?.value ?? 0.2 };
        });
        setParsedItems(items);
      }, [codesInput]);

      const totalValue = parsedItems.reduce((acc, curr) => acc + curr.pts, 0);

      const handleSaveAndBroadcast = async () => {
        if (!targetAthlete) return;
        setSaving(true);
        try {
          const sheet = parsedItems.map((item) => ({ code: item.code, score: item.pts }));
          await updateAthleteDifficulty(targetAthlete.id, sheet);
          toast.success("تم حفظ وتحديث ورقة الصعوبة بنجاح");
          if (onSaved) onSaved();
        } catch (err: any) {
          toast.error("حدث خطأ أثناء حفظ الصعوبات");
        } finally {
          setSaving(false);
        }
      };

      if (!targetAthlete) {
        return (
          <div className="rounded-2xl p-4 border border-border/40 bg-black/40 text-center text-xs text-muted-foreground">
            لا يوجد لاعب محدد حالياً لإدارة ورقة الصعوبة (Group C)
          </div>
        );
      }

      return (
        <div className="num-west rounded-2xl p-4 border border-fed-red/30 bg-black space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-fed-red" />
              <h3 className="text-xs font-heading font-bold text-fed-red uppercase tracking-wider">
                إدارة الصعوبة (Group C) — {targetAthlete.full_name}
              </h3>
              {isLive && <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[9px]">LIVE</Badge>}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">الإجمالي:</span>
              <span className="font-mono font-bold text-gold text-sm">{totalValue.toFixed(2)} pts</span>
            </div>
          </div>

          <div className="space-y-2">
            <Input
              value={codesInput}
              onChange={(e) => setCodesInput(e.target.value)}
              placeholder="أدخل أكواد الصعوبة تفصل بينها مسافات (مثال: 324B 323A 325C)"
              className="font-mono text-xs dir-ltr bg-white/5 border-white/10"
            />
            {parsedItems.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {parsedItems.map((item, idx) => (
                  <Badge key={idx} variant="outline" className="border-fed-red/40 bg-fed-red/10 text-fed-red font-mono text-[10px]">
                    {item.code} <span className="ml-1 opacity-60">({item.pts.toFixed(2)})</span>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-1">
            <Button
              onClick={handleSaveAndBroadcast}
              disabled={saving}
              size="sm"
              className="bg-fed-red hover:bg-fed-red/90 text-white font-bold text-xs"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> : <CheckCircle2 className="h-3.5 w-3.5 ml-1" />}
              حفظ وبث إلى قضاة C
            </Button>
          </div>
        </div>
      );
    }
