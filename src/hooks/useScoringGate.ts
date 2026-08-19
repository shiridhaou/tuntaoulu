import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { MatchSyncSnapshot } from "@/hooks/useMatchSync";

export interface ScoringGate {
  /** Hard lock — every scoring input must be disabled while true. */
  locked: boolean;
  /** Authoritative elapsed seconds mirrored from the Technical Assistant. */
  timerSec: number;
  /** Authoritative run state mirrored from the Technical Assistant. */
  timerRunning: boolean;
}

/**
 * Derives the shared scoring gate (lock + authoritative timer) from the realtime
 * match snapshot and raises a toast whenever the Chief/TA flips the lock.
 * Read-only: it never writes to the sync channel.
 */
export function useScoringGate(sync: MatchSyncSnapshot): ScoringGate {
  const locked = Boolean((sync.payload as Record<string, unknown> | null)?.locked);
  const prev = useRef<boolean | null>(null);

  useEffect(() => {
    if (prev.current === null) { prev.current = locked; return; }
    if (prev.current === locked) return;
    prev.current = locked;
    if (locked) toast.warning("تم قفل التقييم / Scoring Locked");
    else toast.success("تم فتح التقييم / Scoring Unlocked");
  }, [locked]);

  return {
    locked,
    timerSec: sync.elapsedSec,
    timerRunning: sync.timerState === "running",
  };
}
