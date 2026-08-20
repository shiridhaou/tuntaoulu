import { CheckCircle2, Circle } from "lucide-react";
import { useRoomPresence, type RoomRole, type RoomDevice } from "@/hooks/useRoomPresence";

const ROWS: { role: RoomRole; label: string }[] = [
  { role: "chief", label: "رئيس الحكام" },
  { role: "ta", label: "المساعد التقني" },
  { role: "A", label: "المجموعة أ" },
  { role: "B", label: "المجموعة ب" },
  { role: "C", label: "المجموعة ج" },
  { role: "assistant", label: "الحكم المساعد" },
  { role: "display", label: "شاشة العرض" },
];

interface Props {
  sessionCode: string | null;
  me: { role: RoomRole; slot?: string | null; name?: string | null };
  className?: string;
}

/** Completion check: which devices are connected to this session code. */
export function RoomReadyCheck({ sessionCode, me, className = "" }: Props) {
  const devices: RoomDevice[] = useRoomPresence(sessionCode, me);
  const countFor = (role: RoomRole) => devices.filter((d) => d.role === role).length;
  const ready = ROWS.filter((r) => countFor(r.role) > 0).length;

  return (
    <div className={`rounded-xl border border-white/10 bg-white/[0.03] p-3 ${className}`} dir="rtl">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-black text-white/70">الأجهزة المتصلة بالجلسة</span>
        <span className="tabular-nums text-[11px] font-black text-cyan-300" dir="ltr">
          {ready}/{ROWS.length}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {ROWS.map((r) => {
          const n = countFor(r.role);
          return (
            <div
              key={r.role}
              className={`flex items-center justify-between gap-2 rounded-lg border px-2 py-1 text-[11px] ${
                n > 0 ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-white/[0.02] text-white/40"
              }`}
            >
              <span className="flex items-center gap-1.5 truncate font-bold">
                {n > 0 ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                {r.label}
              </span>
              <span className="tabular-nums font-black" dir="ltr">{n}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
