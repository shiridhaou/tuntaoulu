import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type RoomRole = "chief" | "ta" | "A" | "B" | "C" | "assistant" | "display" | "var";

export interface RoomDevice {
  role: RoomRole;
  slot: string | null;
  name?: string | null;
  onlineAt: string;
}

/**
 * Lightweight presence room, isolated per session code.
 * Purely additive: it uses its own channel and never interferes with the
 * authoritative `current_match` sync or the session-state broadcast channel.
 */
export function useRoomPresence(
  sessionCode: string | null,
  me?: { role: RoomRole; slot?: string | null; name?: string | null },
): RoomDevice[] {
  const [devices, setDevices] = useState<RoomDevice[]>([]);
  const meRef = useRef(me);
  meRef.current = me;

  const meKey = me ? `${me.role}:${me.slot ?? ""}` : "";

  useEffect(() => {
    if (!sessionCode) {
      setDevices([]);
      return;
    }
    const channel = supabase.channel(`room-${sessionCode}`, {
      config: { presence: { key: `${meKey}-${Math.random().toString(36).slice(2, 8)}` } },
    });

    const sync = () => {
      const state = channel.presenceState() as Record<string, Array<Record<string, unknown>>>;
      const list: RoomDevice[] = [];
      Object.values(state).forEach((entries) => {
        entries.forEach((e) => {
          if (!e || typeof e.role !== "string") return;
          list.push({
            role: e.role as RoomRole,
            slot: (e.slot as string) ?? null,
            name: (e.name as string) ?? null,
            onlineAt: (e.onlineAt as string) ?? new Date().toISOString(),
          });
        });
      });
      setDevices(list);
    };

    channel
      .on("presence", { event: "sync" }, sync)
      .on("presence", { event: "join" }, sync)
      .on("presence", { event: "leave" }, sync)
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && meRef.current) {
          void channel.track({
            role: meRef.current.role,
            slot: meRef.current.slot ?? null,
            name: meRef.current.name ?? null,
            onlineAt: new Date().toISOString(),
          });
        }
      });

    return () => {
      try { supabase.removeChannel(channel); } catch { /* ignore */ }
    };
  }, [sessionCode, meKey]);

  return devices;
}
