import { Video, Rewind } from "lucide-react";

export function VideoPreview({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-2xl border border-border bg-card overflow-hidden ${compact ? "" : ""}`}>
      <div className="grid grid-cols-2 gap-0.5">
        {/* Live Feed */}
        <div className={`relative bg-[#001529] flex flex-col items-center justify-center ${compact ? "h-32" : "h-48"}`}>
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-fed-red/90">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            <span className="text-[10px] font-heading font-bold text-white tracking-wider">LIVE</span>
          </div>
          <Video className={`${compact ? "h-8 w-8" : "h-12 w-12"} text-white/20`} />
          <p className="text-xs text-white/40 font-body mt-2">البث المباشر</p>
        </div>
        {/* Slow Motion Replay */}
        <div className={`relative bg-[#001529] flex flex-col items-center justify-center ${compact ? "h-32" : "h-48"}`}>
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gold/80">
            <Rewind className="h-3 w-3 text-[#001529]" />
            <span className="text-[10px] font-heading font-bold text-[#001529] tracking-wider">REPLAY</span>
          </div>
          <Rewind className={`${compact ? "h-8 w-8" : "h-12 w-12"} text-white/20`} />
          <p className="text-xs text-white/40 font-body mt-2">إعادة بطيئة</p>
        </div>
      </div>
    </div>
  );
}
