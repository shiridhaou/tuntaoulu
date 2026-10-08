import { useEffect, useMemo, useState } from "react";
import { History, Loader2, Printer, RefreshCw, Unlock, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * POOL HISTORY · read-only per-athlete breakdown for the active category,
 * Chief-only protest re-open, and an IWUF-style printable pool report.
 * Self-contained: reads athletes/results/events; never touches live scoring state.
 */

interface PoolAthlete {
  id: string; full_name: string; bib_number: string | null; club: string | null;
  country: string | null; age_category: string | null; status: string;
}
interface PoolResult {
  id: string; athlete_id: string; score_a: number | null; score_b: number | null;
  score_c: number | null; deductions: number | null; final_score: number;
  published: boolean; payload: Record<string, any> | null; updated_at: string;
}

const r3 = (n: number) => Number(n.toFixed(3));
const f3 = (n: unknown) => (typeof n === "number" || (typeof n === "string" && n !== "")) && Number.isFinite(Number(n)) ? Number(n).toFixed(3) : "—";
const num = (n: unknown) => (Number.isFinite(Number(n)) ? Number(n) : 0);

export function PoolHistoryButton({ sessionCode, canReopen, activeCategory, className, style }: {
  sessionCode: string | null; canReopen: boolean; activeCategory?: string | null;
  className?: string; style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} style={style} title="سجل الفئة / Pool History">
        <History className="h-3.5 w-3.5" /> سجل الفئة / Pool History
      </button>
      {open && <PoolHistoryModal sessionCode={sessionCode} canReopen={canReopen} activeCategory={activeCategory ?? null} onClose={() => setOpen(false)} />}
    </>
  );
}

function PoolHistoryModal({ sessionCode, canReopen, activeCategory, onClose }: {
  sessionCode: string | null; canReopen: boolean; activeCategory: string | null; onClose: () => void;
}) {
  const [athletes, setAthletes] = useState<PoolAthlete[]>([]);
  const [results, setResults] = useState<PoolResult[]>([]);
  const [tName, setTName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<string>(activeCategory ?? "all");
  const [selected, setSelected] = useState<string | null>(null);
  const [printMode, setPrintMode] = useState(false);

  const load = async () => {
    if (!sessionCode) return;
    setLoading(true);
    try {
      const { data: tours } = await supabase.from("tournaments").select("id, name").eq("session_code", sessionCode);
      const ids = (tours ?? []).map((t) => t.id);
      setTName(tours?.[0]?.name ?? "");
      const [{ data: ath }, { data: res }] = await Promise.all([
        ids.length
          ? supabase.from("athletes").select("id, full_name, bib_number, club, country, age_category, status").in("tournament_id", ids)
          : Promise.resolve({ data: [] as PoolAthlete[] }),
        supabase.from("match_results").select("id, athlete_id, score_a, score_b, score_c, deductions, final_score, published, payload, updated_at").eq("session_code", sessionCode),
      ]);
      setAthletes((ath ?? []) as PoolAthlete[]);
      setCategory((c) => (c === "all" || (ath ?? []).some((x: any) => x.age_category === c) ? c : "all"));
      setResults((res ?? []) as unknown as PoolResult[]);
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sessionCode]);

  const categories = useMemo(() => Array.from(new Set(athletes.map((a) => a.age_category).filter(Boolean) as string[])).sort(), [athletes]);

  const latest = useMemo(() => {
    const m = new Map<string, PoolResult>();
    for (const r of results) { const p = m.get(r.athlete_id); if (!p || r.updated_at > p.updated_at) m.set(r.athlete_id, r); }
    return m;
  }, [results]);

  const pool = useMemo(() => athletes.filter((a) => category === "all" || a.age_category === category), [athletes, category]);
  const rows = useMemo(() => {
    const scored = pool.filter((a) => latest.has(a.id)).sort((a, b) => num(latest.get(b.id)!.final_score) - num(latest.get(a.id)!.final_score));
    const rank = new Map(scored.map((a, i) => [a.id, i + 1]));
    const unscored = pool.filter((a) => !latest.has(a.id));
    return [...scored, ...unscored].map((a) => ({ a, r: latest.get(a.id) ?? null, rank: rank.get(a.id) ?? null }));
  }, [pool, latest]);

  const sel = rows.find((x) => x.a.id === selected) ?? null;

  const statusOf = (a: PoolAthlete, r: PoolResult | null) =>
    a.status === "archived" ? "Archived" : r?.published ? "Published" : r ? "Finished" : a.status === "judging" ? "Live" : "Pending";

  return (
    <div className="fixed inset-0 z-[80] bg-background/85 backdrop-blur-sm flex items-center justify-center p-3" dir="rtl">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        .pool-print, .pool-print * { visibility: visible !important; }
        .pool-print { position: absolute; inset: 0; background: #fff !important; color: #000 !important; padding: 12mm; }
        .pool-print * { color: #000 !important; border-color: #999 !important; background: transparent !important; }
        .pool-noprint { display: none !important; }
      }`}</style>
      <div className="w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl border border-border bg-card text-card-foreground shadow-2xl overflow-hidden">
        <div className="pool-noprint flex items-center justify-between gap-2 flex-wrap p-3 border-b border-border">
          <h3 className="font-heading font-black text-sm flex items-center gap-2"><History className="h-4 w-4" /> سجل الفئة / Pool History</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={category} onChange={(e) => { setCategory(e.target.value); setSelected(null); }}
              className="h-8 rounded-lg bg-background border border-border text-xs px-2">
              <option value="all">كل الفئات / All</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={() => void load()} className="h-8 px-2 rounded-lg border border-border text-xs">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </button>
            <button onClick={() => setPrintMode((v) => !v)} className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-black flex items-center gap-1">
              <Printer className="h-3 w-3" /> طباعة تقرير الفئة الشامل / Print Pool Report
            </button>
            <button onClick={onClose} className="h-8 w-8 rounded-lg border border-border flex items-center justify-center"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {printMode ? (
          <div className="flex-1 overflow-auto p-3">
            <div className="pool-noprint flex justify-end mb-2">
              <button onClick={() => window.print()} className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-black flex items-center gap-1">
                <Printer className="h-3 w-3" /> Print / PDF
              </button>
            </div>
            <div className="pool-print" dir="ltr">
              <div className="text-center mb-3">
                <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Tunisian Wushu Federation</p>
                <h2 className="font-heading font-black text-lg">{tName || "Result List"}</h2>
                <p className="text-xs text-muted-foreground">{category === "all" ? "All Categories" : category} · Result List · {new Date().toLocaleString("en-GB")}</p>
              </div>
              <table className="w-full text-xs border-collapse num-west">
                <thead><tr className="border-b-2 border-border">
                  {["Rank", "Bib", "Athlete", "Country / Club", "A", "B", "C", "Ded.", "Final", "Status"].map((h) => <th key={h} className="p-1.5 text-left">{h}</th>)}
                </tr></thead>
                <tbody>
                  {rows.map(({ a, r, rank }) => (
                    <tr key={a.id} className="border-b border-border">
                      <td className="p-1.5 font-bold">{rank ?? "—"}</td>
                      <td className="p-1.5">{a.bib_number ?? "—"}</td>
                      <td className="p-1.5 font-bold">{a.full_name}</td>
                      <td className="p-1.5">{[a.country, a.club].filter(Boolean).join(" / ") || "—"}</td>
                      <td className="p-1.5 font-mono">{f3(r?.score_a)}</td>
                      <td className="p-1.5 font-mono">{f3(r?.score_b)}</td>
                      <td className="p-1.5 font-mono">{f3(r?.score_c ?? (r ? 0 : null))}</td>
                      <td className="p-1.5 font-mono">{f3(r ? num(r.deductions) : null)}</td>
                      <td className="p-1.5 font-mono font-black">{f3(r?.final_score)}</td>
                      <td className="p-1.5">{statusOf(a, r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-8 grid grid-cols-3 gap-6 text-center text-[10px]">
                {["Chief Referee", "Technical Assistant", "Head of Jury"].map((s) => <div key={s} className="border-t border-border pt-1">{s}</div>)}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <div className="overflow-auto border-l border-border">
              {rows.length === 0 && <p className="p-4 text-xs text-muted-foreground">لا يوجد رياضيون.</p>}
              {rows.map(({ a, r, rank }) => {
                const st = statusOf(a, r);
                return (
                  <button key={a.id} disabled={!r} onClick={() => setSelected(a.id)}
                    className={`w-full text-right px-3 py-2 border-b border-border flex items-center gap-2 text-xs ${selected === a.id ? "bg-accent" : ""} ${r ? "hover:bg-accent/60" : "opacity-60 cursor-default"}`}>
                    <span className="w-6 font-black num-west">{rank ?? "—"}</span>
                    <span className="flex-1 font-bold truncate">{a.full_name}</span>
                    <span className="font-mono num-west">{r ? f3(r.final_score) : ""}</span>
                    <span className="text-[10px] rounded px-1.5 py-0.5 border border-border">{st}</span>
                  </button>
                );
              })}
            </div>
            <div className="overflow-auto p-3">
              {sel?.r ? (
                <Breakdown key={sel.r.id + sel.r.updated_at} athlete={sel.a} result={sel.r} rank={sel.rank}
                  canReopen={canReopen} sessionCode={sessionCode} onSaved={() => void load()} />
              ) : <p className="text-xs text-muted-foreground">اختر رياضيًا منتهيًا لعرض التفاصيل (قراءة فقط).</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Breakdown({ athlete, result, rank, canReopen, sessionCode, onSaved }: {
  athlete: PoolAthlete; result: PoolResult; rank: number | null; canReopen: boolean;
  sessionCode: string | null; onSaved: () => void;
}) {
  const p = result.payload ?? {};
  const aDed: any[] = Array.isArray(p.a_deductions) ? p.a_deductions : Array.isArray(p.a_codes) ? p.a_codes : [];
  const bInd: any[] = Array.isArray(p.b_individual) ? p.b_individual : [];
  const cMov: any[] = Array.isArray(p.c_movements) ? p.c_movements : [];
  const cCons: any[] = Array.isArray(p.c_consensus) ? p.c_consensus : [];
  const [editing, setEditing] = useState(false);
  const [c, setC] = useState(f3(result.score_c ?? 0));
  const [hd, setHd] = useState(f3(num(p.chief_deduction)));
  const [cd, setCd] = useState(f3(num(p.choreo_deduction)));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const clamp = (s: string, max: number) => Math.min(max, Math.max(0, num(s.replace(",", "."))));
  const newC = clamp(c, 2), newHd = clamp(hd, 2), newCd = clamp(cd, 2);
  const newDed = r3(newHd + newCd);
  const newFinal = r3(num(result.score_a) + num(result.score_b) + newC - newDed);

  const save = async () => {
    if (!reason.trim()) { toast.error("يرجى إدخال سبب الاحتجاج / Protest reason required"); return; }
    setSaving(true);
    try {
      const before = { score_c: result.score_c, deductions: result.deductions, final_score: result.final_score };
      const { error } = await supabase.from("match_results").update({
        score_c: newC, deductions: newDed, final_score: newFinal, updated_at: new Date().toISOString(),
        payload: { ...p, chief_deduction: newHd, choreo_deduction: newCd,
          reopen_log: [...(Array.isArray(p.reopen_log) ? p.reopen_log : []), { at: Date.now(), reason, before, after: { score_c: newC, deductions: newDed, final_score: newFinal } }] } as never,
      }).eq("id", result.id);
      if (error) throw error;
      if (sessionCode) await supabase.from("match_events").insert({
        session_code: sessionCode, event_type: "CHIEF_OVERRIDE_REOPEN",
        payload: { athlete_id: athlete.id, reason, before, after: { score_c: newC, deductions: newDed, final_score: newFinal } } as never,
      });
      toast.success("تم تعديل النتيجة وإعادة الترتيب");
      setEditing(false); onSaved();
    } catch (e: any) { toast.error(`فشل الحفظ: ${e?.message ?? e}`); }
    finally { setSaving(false); }
  };

  const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
    <div className="flex justify-between text-xs py-0.5"><span className="text-muted-foreground">{k}</span><span className="font-mono num-west">{v}</span></div>
  );

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-heading font-black text-base">{athlete.full_name}</p>
          <p className="text-muted-foreground num-west" dir="ltr">#{athlete.bib_number ?? "—"} · {[athlete.club, athlete.country].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="text-left num-west" dir="ltr">
          <p className="text-2xl font-black font-mono">{f3(result.final_score)}</p>
          <p className="text-muted-foreground">Rank {rank ?? "—"}</p>
        </div>
      </div>

      <section className="rounded-lg border border-border p-2">
        <p className="font-bold mb-1">Group A · Quality — {f3(result.score_a)}</p>
        {aDed.length === 0 ? <p className="text-muted-foreground">لا توجد تفاصيل خصم محفوظة.</p> :
          aDed.map((d, i) => <Row key={i} k={String(d.code ?? d.label ?? "—")} v={f3(num(d.value ?? d.deduction))} />)}
      </section>

      <section className="rounded-lg border border-border p-2">
        <p className="font-bold mb-1">Group B · Performance — {f3(result.score_b)}</p>
        {bInd.map((b, i) => <Row key={i} k={`${b.slot ?? "B"}${b.role && b.role !== "kept" ? ` (${b.role})` : ""}`} v={f3(b.score)} />)}
      </section>

      <section className="rounded-lg border border-border p-2">
        <p className="font-bold mb-1">Group C · Nandu — {f3(result.score_c ?? 0)}</p>
        {cCons.length > 0 ? cCons.map((it, i) => (
          <Row key={i} k={`${it.code}${it.yes != null ? ` · ${it.yes}/${(it.yes ?? 0) + (it.no ?? 0)}` : ""}`}
            v={`${it.decision ?? it.majority ?? "—"} · ${f3(num(it.value))}`} />
        )) : cMov.length === 0 ? <p className="text-muted-foreground">لا توجد رموز.</p> :
          cMov.map((m, i) => <Row key={i} k={`${m.code}${m.label ? ` · ${m.label}` : ""}`}
            v={`${m.successful === true ? "YES (majority)" : m.successful === false ? "NO" : "—"} · ${f3(num(m.value))}`} />)}
      </section>

      <section className="rounded-lg border border-border p-2">
        <p className="font-bold mb-1">Line Judge / Timing / Deductions</p>
        <Row k="Out of bounds (count)" v={num(p.ta_oob_count)} />
        <Row k="TA timing note (info only)" v={f3(num(p.ta_info_deduction))} />
        <Row k="HD · Chief deduction" v={f3(num(p.chief_deduction))} />
        <Row k="CD · Choreography" v={f3(num(p.choreo_deduction))} />
        <Row k="Total deductions" v={f3(num(result.deductions))} />
        {Array.isArray(p.reopen_log) && p.reopen_log.length > 0 && (
          <p className="mt-1 text-[10px] text-muted-foreground">Re-opened {p.reopen_log.length}× — last: {String(p.reopen_log[p.reopen_log.length - 1]?.reason ?? "")}</p>
        )}
      </section>

      {canReopen && (!editing ? (
        <button onClick={() => setEditing(true)} className="w-full h-9 rounded-lg bg-destructive text-destructive-foreground font-black flex items-center justify-center gap-2">
          <Unlock className="h-4 w-4" /> إعادة فتح النتيجة / Re-Open &amp; Modify
        </button>
      ) : (
        <section className="rounded-lg border border-destructive p-2 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {([["C (Nandu)", c, setC], ["HD", hd, setHd], ["CD", cd, setCd]] as const).map(([l, v, set]) => (
              <label key={l} className="space-y-1"><span className="text-muted-foreground">{l}</span>
                <input type="text" inputMode="decimal" value={v} onChange={(e) => set(e.target.value)}
                  onBlur={(e) => set(clamp(e.target.value, 2).toFixed(3))}
                  className="w-full h-8 rounded border border-border bg-background px-2 font-mono num-west" dir="ltr" /></label>
            ))}
          </div>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب الاحتجاج المقبول / Accepted protest reason"
            className="w-full h-8 rounded border border-border bg-background px-2" />
          <p className="num-west" dir="ltr">New final = {f3(result.score_a)} + {f3(result.score_b)} + {newC.toFixed(3)} − {newDed.toFixed(3)} = <b>{newFinal.toFixed(3)}</b></p>
          <div className="flex gap-2">
            <button disabled={saving} onClick={() => void save()} className="flex-1 h-8 rounded bg-primary text-primary-foreground font-black">
              {saving ? <Loader2 className="h-3 w-3 animate-spin inline" /> : "حفظ / Save"}</button>
            <button onClick={() => setEditing(false)} className="h-8 px-3 rounded border border-border">إلغاء</button>
          </div>
        </section>
      ))}
    </div>
  );
}
