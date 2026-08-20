import { KeyRound } from "lucide-react";
import { useActiveSessionCode } from "@/hooks/useActiveSession";

interface SessionBadgeProps {
  /** Session code known by the panel; falls back to URL / localStorage. */
  code?: string | null;
  className?: string;
}

/** Mandatory header badge showing the active session code on every role screen. */
export function SessionBadge({ code, className = "" }: SessionBadgeProps) {
  const active = useActiveSessionCode(code);
  return (
    <span
      dir="ltr"
      title="رمز الجلسة النشطة"
      className={`shrink-0 inline-flex items-center gap-1 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-black tracking-[0.18em] text-cyan-200 tabular-nums ${className}`}
    >
      <KeyRound className="h-3 w-3" />
      {active ?? "NO SESSION"}
    </span>
  );
}
