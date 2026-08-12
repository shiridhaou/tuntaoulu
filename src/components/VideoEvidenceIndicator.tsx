import { useEffect, useState } from "react";
import { Video, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Lightweight Chief-side indicator: shows a 📹 icon when the VAR has captured
 * a clip for the currently performing athlete, and turns into a green ✅ once
 * the VAR presses "Verify". No video stream is sent to the Chief — only metadata.
 *
 * Listens to two event_types on `match_events`:
 *  - `ahj_clip`           → new clip available (count++)
 *  - `ahj_clip_verified`  → AHJ confirmed (verifiedCount++)
 */
export function VideoEvidenceIndicator({
  sessionCode,
  athleteId,
}: {
  sessionCode: string | null;
  athleteId: string | null;
}) {
  const [clipCount, setClipCount] = useState(0);
  const [verifiedCount, setVerifiedCount] = useState(0);
  const [pulseKey, setPulseKey] = useState(0);

  // Reset counters whenever the athlete changes
  useEffect(() => {
    setClipCount(0);
    setVerifiedCount(0);
  }, [athleteId]);

  useEffect(() => {
    if (!sessionCode) return;
    const channel = supabase
      .channel(`chief-ahj-evidence-${sessionCode}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "match_events", filter: `session_code=eq.${sessionCode}` },
        (payload) => {
          const row = payload.new as { event_type: string; payload: Record<string, unknown> | null };
          const p = row.payload ?? {};
          // Only count clips tied to the currently performing athlete
          if (athleteId && p.athleteId !== athleteId) return;
          if (row.event_type === "ahj_clip") {
            setClipCount((n) => n + 1);
            setPulseKey((k) => k + 1);
          } else if (row.event_type === "ahj_clip_verified") {
            setVerifiedCount((n) => n + 1);
            setPulseKey((k) => k + 1);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionCode, athleteId]);

  if (clipCount === 0) return null;

  const allVerified = verifiedCount >= clipCount && verifiedCount > 0;

  return (
    <div
      key={pulseKey}
      title={allVerified ? "تم تأكيد جميع الكليبات من قبل VAR" : `${clipCount} كليب متاح من VAR`}
      className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[10px] font-heading font-bold tracking-wider animate-in fade-in zoom-in duration-300 ${
        allVerified
          ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-300"
          : "bg-orange-500/20 border-orange-400/50 text-orange-300"
      }`}
      dir="ltr"
    >
      <Video className="h-3 w-3" />
      <span>{clipCount}</span>
      {verifiedCount > 0 && (
        <>
          <CheckCircle2 className="h-3 w-3 text-emerald-300" />
          <span>{verifiedCount}</span>
        </>
      )}
    </div>
  );
}
