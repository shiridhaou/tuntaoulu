import { X } from "lucide-react";
import type { GroupARule } from "@/config/groupARulesEngine";
import { GROUP_A_GROUP_INFO } from "@/config/groupARulesEngine";
import { CATEGORY_INFO } from "@/lib/deductionDiagrams";

type Props = {
  open: boolean;
  decade: string;
  rules: GroupARule[];
  onPick: (r: GroupARule) => void;
  onClose: () => void;
};

/**
 * Deduction details popover for Group A.
 * Presentational only — receives rules and callbacks from the panel.
 * Key 7 never logs directly: the judge must pick a sub-code here.
 */
export function DeductionModal({ open, decade, rules, onPick, onClose }: Props) {
  if (!open) return null;
  const info = GROUP_A_GROUP_INFO[decade];
  const diagram = CATEGORY_INFO[decade]?.image;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0b0b0b] text-white"
        onClick={e => e.stopPropagation()}
      >
        <header className="sticky top-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 bg-[#0b0b0b]/95 backdrop-blur">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/40" dir="ltr">
              KEY {decade}{info ? ` · ${info.pinyin}` : ""}
            </p>
            <h2 className="text-base font-black truncate" dir="rtl">{info?.titleAr ?? "الأكواد"}</h2>
            {info && <p className="text-[10px] text-white/40" dir="ltr">{info.titleEn}</p>}
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 shrink-0 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {diagram && (
          <div className="px-4 pt-4">
            <div className="rounded-2xl border border-white/10 bg-black p-3 flex justify-center">
              <img
                src={diagram}
                alt={`رسم توضيحي — ${info?.titleAr ?? decade}`}
                loading="lazy"
                className="max-h-44 object-contain"
                style={{ filter: "grayscale(1) invert(1) contrast(1.4) brightness(1.1)" }}
              />
            </div>
          </div>
        )}

        <div className="p-4 grid gap-2 sm:grid-cols-2">
          {rules.map(r => (
            <button
              key={r.errorCode}
              onClick={() => onPick(r)}
              className="rounded-2xl border border-white/10 bg-black/60 p-3 text-right active:scale-[0.97] transition-all hover:border-emerald-500/50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xl font-black tabular-nums" dir="ltr">{r.errorCode}</span>
                <span className="text-base font-black tabular-nums text-red-400" dir="ltr">−{r.deductionValue.toFixed(2)}</span>
              </div>
              <p className="mt-0.5 text-[11px] font-bold text-emerald-300/80" dir="ltr">{r.pinyin}</p>
              <p className="mt-1 text-[12px] font-bold text-white/85" dir="rtl">{r.arabicDescription}</p>
              <p className="text-[11px] text-white/50" dir="ltr">{r.englishDescription}</p>
            </button>
          ))}
          {rules.length === 0 && (
            <p className="text-[12px] text-white/40 col-span-full text-center py-6" dir="rtl">
              لا توجد أكواد في هذه الفئة لهذا الأسلوب
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
