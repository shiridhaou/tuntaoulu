import { GROUP_A_KEYS, GROUP_A_GROUP_INFO } from "@/config/groupARulesEngine";

function haptic(ms: number | number[] = 18) {
  try { (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean })?.vibrate?.(ms); } catch { /* noop */ }
}

type Props = {
  /** Keys (0–7) enabled for the live style, from existing sync props */
  availableDecades: string[];
  activeDecade: string;
  onSelect: (decade: string) => void;
};

/**
 * Group A keypad — always renders keys 0–7.
 * Purely presentational: it consumes props, never touches sync state.
 */
export function GroupAKeypad({ availableDecades, activeDecade, onSelect }: Props) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
      {GROUP_A_KEYS.map(d => {
        const enabled = availableDecades.includes(d);
        const active = enabled && activeDecade === d;
        const info = GROUP_A_GROUP_INFO[d];
        return (
          <button
            key={d}
            disabled={!enabled}
            onClick={() => { haptic(18); onSelect(d); }}
            title={info ? `${info.pinyin} — ${info.titleAr}` : d}
            className="h-16 rounded-xl font-black tabular-nums select-none active:scale-[0.95] transition-all disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed flex flex-col items-center justify-center"
            style={{
              background: active ? "rgba(52,211,153,0.18)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${active ? "rgba(52,211,153,0.75)" : "rgba(255,255,255,0.12)"}`,
              color: active ? "#6ee7b7" : "#fff",
              boxShadow: active ? "0 0 22px rgba(52,211,153,0.4)" : "none",
              backdropFilter: "blur(14px)",
            }}
            dir="ltr"
          >
            <span style={{ fontSize: "clamp(18px, 3vw, 28px)", lineHeight: 1 }}>{d}</span>
            {info && (
              <span className="mt-0.5 text-[8px] font-bold tracking-wide opacity-60 truncate max-w-full px-1">
                {info.pinyin}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
