import { useEffect, useState } from "react";
import { Loader2, UserPlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * LATE ATHLETE REGISTRATION · self-contained quick-add modal.
 * Inserts straight into the active tournament's athletes table; every screen
 * already listening to athletes realtime picks the new row up instantly.
 */
export function QuickAddAthleteButton({ sessionCode, defaultCategory, defaultStyle, className, style, onAdded }: {
  sessionCode: string | null; defaultCategory?: string | null; defaultStyle?: string | null;
  className?: string; style?: React.CSSProperties; onAdded?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} style={style} title="إضافة لاعب سريع / Add Missing Athlete">
        <UserPlus className="h-3.5 w-3.5" /> إضافة لاعب سريع / Add Athlete
      </button>
      {open && <QuickAddModal sessionCode={sessionCode} defaultCategory={defaultCategory ?? ""} defaultStyle={defaultStyle ?? ""}
        onClose={() => setOpen(false)} onAdded={onAdded} />}
    </>
  );
}

function QuickAddModal({ sessionCode, defaultCategory, defaultStyle, onClose, onAdded }: {
  sessionCode: string | null; defaultCategory: string; defaultStyle: string; onClose: () => void; onAdded?: () => void;
}) {
  const [name, setName] = useState("");
  const [bib, setBib] = useState("");
  const [club, setClub] = useState("");
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState(defaultCategory);
  const [styleV, setStyleV] = useState(defaultStyle);
  const [order, setOrder] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [styles, setStyles] = useState<string[]>([]);
  const [tid, setTid] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!sessionCode) return;
    void (async () => {
      const { data: t } = await supabase.from("tournaments").select("id").eq("session_code", sessionCode)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!t) return;
      setTid(t.id);
      const { data: a } = await supabase.from("athletes").select("age_category, style").eq("tournament_id", t.id);
      setCats(Array.from(new Set((a ?? []).map((x) => x.age_category).filter(Boolean) as string[])).sort());
      setStyles(Array.from(new Set((a ?? []).map((x) => x.style).filter(Boolean) as string[])).sort());
    })();
  }, [sessionCode]);

  const save = async () => {
    if (!name.trim()) { toast.error("الاسم مطلوب / Name required"); return; }
    if (!tid) { toast.error("لا توجد بطولة نشطة / No active tournament"); return; }
    setSaving(true);
    try {
      const ord = Number(order.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
      const { error } = await supabase.from("athletes").insert({
        tournament_id: tid, full_name: name.trim(), bib_number: bib.trim() || null,
        club: club.trim() || null, country: country.trim() || null,
        age_category: category.trim() || null, style: styleV.trim() || null,
        sequence_order: Number.isFinite(ord) && ord > 0 ? Math.round(ord) : null,
        status: "waiting",
      });
      if (error) throw error;
      if (sessionCode) void supabase.from("match_events").insert({
        session_code: sessionCode, event_type: "LATE_ATHLETE_ADDED",
        payload: { name: name.trim(), bib, category, style: styleV, order: ord || null } as never,
      });
      toast.success("تمت إضافة اللاعب / Athlete added");
      onAdded?.(); onClose();
    } catch (e: any) { toast.error(`فشل الحفظ: ${e?.message ?? e}`); }
    finally { setSaving(false); }
  };

  const field = "w-full h-9 rounded-lg border border-border bg-background px-2 text-sm";
  return (
    <div className="fixed inset-0 z-[90] bg-background/85 backdrop-blur-sm flex items-center justify-center p-3" dir="rtl">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card text-card-foreground shadow-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-black text-sm flex items-center gap-2"><UserPlus className="h-4 w-4" /> إضافة لاعب سريع / Add Missing Athlete</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-lg border border-border flex items-center justify-center"><X className="h-4 w-4" /></button>
        </div>
        <label className="block space-y-1 text-xs"><span>الاسم الكامل / Full Name *</span>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className={field} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1 text-xs"><span>الرقم / Bib</span>
            <input value={bib} onChange={(e) => setBib(e.target.value)} className={`${field} num-west`} dir="ltr" /></label>
          <label className="block space-y-1 text-xs"><span>الترتيب / Order</span>
            <input value={order} inputMode="numeric" onChange={(e) => setOrder(e.target.value)} placeholder="1, 2, 3…" className={`${field} num-west`} dir="ltr" /></label>
          <label className="block space-y-1 text-xs"><span>النادي / Club</span>
            <input value={club} onChange={(e) => setClub(e.target.value)} className={field} /></label>
          <label className="block space-y-1 text-xs"><span>البلد / Country</span>
            <input value={country} onChange={(e) => setCountry(e.target.value)} className={field} /></label>
          <label className="block space-y-1 text-xs"><span>الفئة / Category</span>
            <input list="qa-cats" value={category} onChange={(e) => setCategory(e.target.value)} className={field} />
            <datalist id="qa-cats">{cats.map((c) => <option key={c} value={c} />)}</datalist></label>
          <label className="block space-y-1 text-xs"><span>الروتين / Taolu</span>
            <input list="qa-styles" value={styleV} onChange={(e) => setStyleV(e.target.value)} className={field} />
            <datalist id="qa-styles">{styles.map((s) => <option key={s} value={s} />)}</datalist></label>
        </div>
        <button disabled={saving} onClick={() => void save()} className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-black text-sm">
          {saving ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "حفظ وإضافة للفئة / Save"}
        </button>
      </div>
    </div>
  );
}
