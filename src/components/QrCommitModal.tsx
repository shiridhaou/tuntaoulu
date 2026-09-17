import { QRCodeSVG } from "qrcode.react";
import { X, ExternalLink, Sparkles } from "lucide-react";
import { Link } from "@tanstack/react-router";

const GOLD = "#F4C542";
const ORANGE = "#FF7A1A";

interface QrCommitModalProps {
  athleteId: string;
  athleteName: string;
  finalScore: number;
  onClose: () => void;
}

export function QrCommitModal({ athleteId, athleteName, finalScore, onClose }: QrCommitModalProps) {
  const reportUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/athlete-report/${athleteId}`
      : `/athlete-report/${athleteId}`;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-[#0a0a0a] border p-6 relative animate-in fade-in zoom-in-95 duration-300"
        style={{ borderColor: `${GOLD}66`, boxShadow: `0 0 80px ${ORANGE}44` }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border mb-3"
               style={{ background: `${GOLD}15`, borderColor: `${GOLD}55` }}>
            <Sparkles className="h-3.5 w-3.5" style={{ color: GOLD }} />
            <span className="text-[10px] font-heading font-black tracking-[0.3em]" style={{ color: GOLD }}>
              SCORE COMMITTED
            </span>
          </div>
          <h2 className="font-heading font-black text-xl text-white">{athleteName}</h2>
          <p className="font-heading font-black text-5xl tabular-nums mt-1" style={{ color: ORANGE, textShadow: `0 0 20px ${ORANGE}80` }} dir="ltr">
            {finalScore.toFixed(3)}
          </p>
        </div>

        <div className="rounded-2xl bg-white p-5 flex items-center justify-center mb-4">
          <QRCodeSVG
            value={reportUrl}
            size={220}
            level="M"
            bgColor="#ffffff"
            fgColor="#0a0a0a"
            includeMargin={false}
          />
        </div>

        <p className="text-center text-[11px] text-white/50 mb-4 font-body">
          امسح الكود بهاتفك لفتح تقرير الـ AI
          <br />
          <span className="text-white/30 font-mono text-[10px]">{reportUrl}</span>
        </p>

        <Link
          to="/athlete-report/$id"
          params={{ id: athleteId }}
          target="_blank"
          onClick={onClose}
          className="w-full h-11 rounded-xl flex items-center justify-center gap-2 font-heading font-black text-xs tracking-[0.25em] transition-all hover:brightness-110"
          style={{ background: `linear-gradient(135deg, ${GOLD}, ${ORANGE})`, color: "#000",
                   boxShadow: `0 0 20px ${ORANGE}55` }}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          فتح التقرير
        </Link>
      </div>
    </div>
  );
}
