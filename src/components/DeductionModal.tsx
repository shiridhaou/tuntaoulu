import { X } from "lucide-react";
import type { CodeEntry } from "@/lib/deductionCodes";
import { CATEGORY_INFO, CODE_PINYIN } from "@/lib/deductionDiagrams";

type Props = {
  open: boolean;
  decade: string;
  codes: CodeEntry[];
  onPick: (c: CodeEntry) => void;
  onClose: () => void;
};

/**
 * Deduction details popover for Group A.
 * Presentational only — receives codes and callbacks from the panel.
 */
export function DeductionModal({ open, decade, codes, onPick, onClose }: Props) {
  if (!open) return null;
  const info = CATEGORY_INFO[decade];

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
              CATEGORY {decade}{info ? ` · ${info.pinyin}` : ""}
            </p>
            <h2 className="text-base font-black truncate" dir="rtl">{info?.titleAr ?? "الأكواد"}</h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 shrink-0 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center"
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {info && (
          <div className="px-4 pt-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 flex justify-center">
              <img
                src={info.image}
                alt={`رسم توضيحي — ${info.titleAr}`}
                loading="lazy"
                className="max-h-44 object-contain"
              />
            </div>
          </div>
        )}

        <div className="p-4 grid gap-2 sm:grid-cols-2">
          {codes.map(c => (
            <button
              key={c.code}
              onClick={() => onPick(c)}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-right active:scale-[0.97] transition-all hover:border-emerald-500/50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xl font-black tabular-nums" dir="ltr">{c.code}</span>
                <span className="text-base font-black tabular-nums text-red-400" dir="ltr">−{c.value.toFixed(2)}</span>
              </div>
              {CODE_PINYIN[c.code] && (
                <p className="mt-0.5 text-[11px] font-bold text-emerald-300/80" dir="ltr">{CODE_PINYIN[c.code]}</p>
              )}
              <p className="mt-1 text-[12px] font-bold text-white/85" dir="rtl">{c.labelAr}</p>
              <p className="text-[11px] text-white/50" dir="ltr">{c.label}</p>
            </button>
          ))}
          {codes.length === 0 && (
            <p className="text-[12px] text-white/40 col-span-full text-center py-6" dir="rtl">
              لا توجد أكواد في هذه الفئة لهذا الأسلوب
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
