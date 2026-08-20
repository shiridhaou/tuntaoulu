import { useState } from "react";
import { Users, X } from "lucide-react";
import { RoomReadyCheck } from "@/components/RoomReadyCheck";
import { useRoomPresence, type RoomRole } from "@/hooks/useRoomPresence";

interface Props {
  sessionCode: string | null;
  me: { role: RoomRole; slot?: string | null; name?: string | null };
}

/** Floating "room completion" widget for the Chief and TA panels. */
export function RoomReadyWidget({ sessionCode, me }: Props) {
  const [open, setOpen] = useState(false);
  const devices = useRoomPresence(sessionCode, me);

  return (
    <div className="fixed bottom-3 left-3 z-50 w-[290px] max-w-[85vw]">
      {open ? (
        <div className="relative rounded-xl border border-white/10 bg-black/85 backdrop-blur-xl shadow-2xl">
          <button
            onClick={() => setOpen(false)}
            className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-md text-white/50 hover:text-white"
            aria-label="إغلاق"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <RoomReadyCheck sessionCode={sessionCode} me={me} className="border-0 bg-transparent" />
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full border border-cyan-400/40 bg-black/80 px-3 py-1.5 text-[11px] font-black text-cyan-200 backdrop-blur hover:bg-black"
          dir="rtl"
        >
          <Users className="h-3.5 w-3.5" />
          الأجهزة المتصلة
          <span className="tabular-nums text-white/70" dir="ltr">{devices.length}</span>
        </button>
      )}
    </div>
  );
}
