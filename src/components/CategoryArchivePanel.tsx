import { useEffect, useMemo, useState } from "react";
import { Archive, FileText, Loader2, Printer, RefreshCw, Trophy } from "lucide-react";
import { Button } from "./ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { broadcastPublicStandings, broadcastSessionState, broadcastStandingsToggle } from "@/hooks/useMatchSync";

export interface ArchiveAthlete {
  id: string;
  full_name: string;
  bib_number: string | null;
  club: string | null;
  country: string | null;
  age_category: string | null;
  style?: string | null;
  status: string;
}

interface ResultRow {
  athlete_id: string;
  athlete_name: string | null;
  score_a: number | null;
  score_b: number | null;
  score_c: number | null;
  deductions: number | null;
  final_score: number;
  published: boolean;
}

interface EventRow {
  event_type: string;
  payload: Record<string, unknown> | null;
  created_at: string;
}

const NOTE_EVENTS = ["deduction", "penalty", "oob", "var", "choreo", "override", "chief"];

const fmt3 = (n: number | null | undefined) =>
  typeof n === "number" && Number.isFinite(n) ? n.toFixed(3) : "—";

/**
 * TECHNICAL ASSISTANT · Category Summary & Archive
 * Read-only reporting surface: ranks the finished athletes of one category with
 * their A / B / C / deduction breakdown, lists the jury notes log, prints the
 * official summary sheet, and archives the category so the mat starts clean.
 */
export function CategoryArchivePanel({
  sessionCode,
  tournamentName,
  athletes,
  onArchived,
}: {
  sessionCode: string | null;
  tournamentName?: string | null;
  athletes: ArchiveAthlete[];
  onArchived?: () => void;
}) {
  const [results, setResults] = useState<ResultRow[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [category, setCategory] = useState<string>("all");

  const categories = useMemo(() => {
    const set = new Set<string>();
    athletes.forEach((a) => { if (a.age_category) set.add(a.age_category); });
    return Array.from(set).sort();
  }, [athletes]);

  const load = async () => {
    if (!sessionCode) return;
    setLoading(true);
    try {
      const [{ data: resultRows }, { data: eventRows }] = await Promise.all([
        supabase
          .from("match_results")
          .select("athlete_id, athlete_name, score_a, score_b, score_c, deductions, final_score, published")
          .eq("session_code", sessionCode),
        supabase
          .from("match_events")
          .select("event_type, payload, created_at")
          .eq("session_code", sessionCode)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);
      setResults((resultRows ?? []) as unknown as ResultRow[]);
      setEvents((eventRows ?? []) as unknown as EventRow[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sessionCode]);

  const inCategory = useMemo(
    () => athletes.filter((a) => category === "all" || a.age_category === category),
    [athletes, category],
  );

  const ranked = useMemo(() => {
    const byId = new Map(inCategory.map((a) => [a.id, a]));
    return results
      .filter((r) => byId.has(r.athlete_id))
      .flatMap((r) => {
        const athlete = byId.get(r.athlete_id);
        return athlete ? [{ ...r, athlete }] : [];
      })
      .sort((a, b) => Number(b.final_score) - Number(a.final_score));
  }, [results, inCategory]);

  const notes = useMemo(
    () => events.filter((e) => NOTE_EVENTS.some((t) => e.event_type.toLowerCase().includes(t))),
    [events],
  );

  const pending = inCategory.filter((a) => a.status === "waiting" || a.status === "judging").length;
  const categoryComplete = inCategory.length > 0 && pending === 0;

  const archiveCategory = async () => {
    if (!sessionCode || archiving) return;
    const ids = inCategory.map((a) => a.id);
    if (ids.length === 0) return;
    if (!confirm(
      `أرشفة الفئة (${category === "all" ? "كل الفئات" : category})؟\nArchive this category and clear the mat for the next one?`,
    )) return;
    setArchiving(true);
    try {
      const nextAthlete = athletes.find((athlete) => !ids.includes(athlete.id) && athlete.status !== "archived") ?? null;
      const { error: archiveError } = await supabase.from("athletes").update({ status: "archived" }).in("id", ids);
      if (archiveError) throw archiveError;

      const { data: currentRow, error: currentError } = await supabase
        .from("current_match")
        .select("payload")
        .eq("session_code", sessionCode)
        .maybeSingle();
      if (currentError) throw currentError;
      const previousPayload = currentRow?.payload && typeof currentRow.payload === "object"
        ? currentRow.payload as Record<string, unknown>
        : {};
      const nextAthletePayload = nextAthlete ? {
        id: nextAthlete.id,
        name: nextAthlete.full_name,
        bib: nextAthlete.bib_number,
        club: nextAthlete.club,
        country: nextAthlete.country,
        category: nextAthlete.age_category,
      } : null;
      const readyPayload = {
        ...previousPayload,
        match_status: "READY",
        status: "READY",
        category: nextAthlete?.age_category ?? null,
        athlete: nextAthletePayload,
        activeAthlete: nextAthletePayload,
        show_standings_overlay: false,
      };

      const { error: scoresError } = await supabase.from("judge_scores").delete().eq("session_code", sessionCode);
      if (scoresError) throw scoresError;
      const { error: statusError } = await supabase.from("judge_status").delete().eq("session_code", sessionCode);
      if (statusError) throw statusError;
      const { error: matchError } = await supabase.from("current_match").upsert({
        session_code: sessionCode,
        athlete_id: nextAthlete?.id ?? null,
        style: nextAthlete?.style ?? null,
        timer_state: "idle",
        started_at: null,
        elapsed_ms: 0,
        payload: readyPayload as never,
        ta_deductions: { time: { value: 0 }, oob: { count: 0, value: 0 }, total: 0 } as never,
        updated_at: new Date().toISOString(),
      }, { onConflict: "session_code" });
      if (matchError) throw matchError;

      await broadcastSessionState(sessionCode, {
        athlete_id: nextAthlete?.id ?? null,
        current_athlete_id: nextAthlete?.id ?? null,
        match_status: "READY",
        show_standings_overlay: false,
        timer_state: "idle",
        started_at: null,
        elapsed_ms: 0,
        style: nextAthlete?.style ?? null,
        payload: readyPayload,
      });
      void broadcastStandingsToggle(sessionCode, false);
      void broadcastPublicStandings(sessionCode, false);

      const { error: eventError } = await supabase.from("match_events").insert({
        session_code: sessionCode,
        event_type: "CATEGORY_ARCHIVED",
        payload: {
          category,
          status: "ARCHIVED",
          athletes: ids.length,
          next_athlete_id: nextAthlete?.id ?? null,
          next_category: nextAthlete?.age_category ?? null,
          at: Date.now(),
        } as never,
      });
      if (eventError) throw eventError;
      toast.success(nextAthlete
        ? `تمت الأرشفة — الفئة التالية ${nextAthlete.age_category ?? "جاهزة"}`
        : "تمت الأرشفة — لا توجد فئة نشطة تالية");
      onArchived?.();
      await load();
    } catch (e: any) {
      toast.error(`فشلت الأرشفة: ${e?.message ?? e}`);
    } finally {
      setArchiving(false);
    }
  };

  return (
    <section className="glass-card rounded-2xl p-4 space-y-3" dir="rtl">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .ta-archive-print, .ta-archive-print * { visibility: visible !important; }
          .ta-archive-print { position: absolute; inset: 0; background: #fff; color: #000; padding: 16px; }
          .ta-archive-noprint { display: none !important; }
        }
      `}</style>

      <div className="ta-archive-noprint flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-gold" />
          <h3 className="font-heading font-bold text-gold text-sm">
            التقرير النهائي والأرشفة / Category Summary &amp; Archive
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-8 rounded-lg bg-black/60 border border-white/15 text-xs px-2 text-white"
          >
            <option value="all">كل الفئات / All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-gold/50 text-gold hover:bg-gold/10"
            onClick={() => window.print()}
            disabled={ranked.length === 0}
          >
            <Printer className="h-3 w-3 ml-1" /> طباعة / PDF
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs bg-fed-red hover:brightness-110 text-white"
            onClick={() => void archiveCategory()}
            disabled={archiving || !sessionCode || inCategory.length === 0}
          >
            {archiving ? <Loader2 className="h-3 w-3 animate-spin ml-1" /> : <Archive className="h-3 w-3 ml-1" />}
            أرشفة الفئة / Archive
          </Button>
        </div>
      </div>

      <p className="ta-archive-noprint text-[11px] text-muted-foreground">
        {categoryComplete
          ? "✅ اكتملت كل الرياضيين في هذه الفئة — يمكن إصدار التقرير والأرشفة."
          : `⏳ ما زال ${pending} رياضي/رياضيين قيد الانتظار في هذه الفئة.`}
      </p>

      {/* ── PRINTABLE REPORT ─────────────────────────────── */}
      <div className="ta-archive-print rounded-xl border border-white/10 bg-black/30 p-3">
        <div className="text-center mb-3">
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Tunisian Wushu Federation</p>
          <h4 className="font-heading font-black text-base text-gold">
            {tournamentName ?? "Category Result List"}
          </h4>
          <p className="text-[11px] text-muted-foreground num-west" dir="ltr">
            {category === "all" ? "All Categories" : category} · {new Date().toLocaleString("en-GB")}
            {sessionCode ? ` · ${sessionCode}` : ""}
          </p>
        </div>

        <table className="w-full text-[11px] num-west" dir="ltr">
          <thead>
            <tr className="text-muted-foreground border-b border-white/10">
              <th className="p-1.5 text-left">#</th>
              <th className="p-1.5 text-left">Bib</th>
              <th className="p-1.5 text-left">Athlete</th>
              <th className="p-1.5 text-left">Club / Country</th>
              <th className="p-1.5 text-right">A</th>
              <th className="p-1.5 text-right">B</th>
              <th className="p-1.5 text-right">C</th>
              <th className="p-1.5 text-right">Ded.</th>
              <th className="p-1.5 text-right">Final</th>
            </tr>
          </thead>
          <tbody>
            {ranked.length === 0 ? (
              <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">
                لا توجد نتائج محفوظة لهذه الفئة بعد
              </td></tr>
            ) : ranked.map((r, i) => (
              <tr key={r.athlete_id} className="border-b border-white/5">
                <td className="p-1.5 font-bold text-gold">{i + 1}</td>
                <td className="p-1.5">{r.athlete.bib_number ?? "—"}</td>
                <td className="p-1.5 font-bold">{r.athlete.full_name || r.athlete_name || "—"}</td>
                <td className="p-1.5 text-muted-foreground">
                  {[r.athlete.club, r.athlete.country].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="p-1.5 text-right font-mono">{fmt3(r.score_a)}</td>
                <td className="p-1.5 text-right font-mono">{fmt3(r.score_b)}</td>
                <td className="p-1.5 text-right font-mono">{fmt3(r.score_c)}</td>
                <td className="p-1.5 text-right font-mono text-fed-red">{fmt3(r.deductions ?? 0)}</td>
                <td className="p-1.5 text-right font-mono font-black text-emerald-400">{fmt3(Number(r.final_score))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Jury notes / penalties log */}
        <div className="mt-4">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-gold mb-1">
            <Trophy className="h-3 w-3" /> ملاحظات وعقوبات هيئة الحكام / Chief &amp; Jury Notes
          </p>
          {notes.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">لا توجد ملاحظات مسجلة.</p>
          ) : (
            <ul className="space-y-0.5">
              {notes.slice(0, 40).map((e, i) => (
                <li key={i} className="text-[10px] text-muted-foreground num-west" dir="ltr">
                  {new Date(e.created_at).toLocaleTimeString("en-GB")} · {e.event_type}
                  {e.payload ? ` · ${JSON.stringify(e.payload).slice(0, 120)}` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-4 text-center text-[10px] text-muted-foreground">
          {["Chief Referee", "Technical Assistant", "Head of Jury"].map((s) => (
            <div key={s}>
              <div className="border-t border-white/30 pt-1">{s}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
