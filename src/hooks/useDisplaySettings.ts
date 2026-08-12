import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DisplaySettings {
  marquee: string;
  sponsors: string[];        // public URLs
  leaderboardMode: boolean;
}

const DEFAULTS: DisplaySettings = {
  marquee: "الجامعة التونسية للووشو كونغ فو — Tunisian Wushu Kung Fu Federation",
  sponsors: [],
  leaderboardMode: false,
};

function extract(payload: unknown): DisplaySettings {
  const p = (payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {}) as Record<string, unknown>;
  const d = (p.display && typeof p.display === "object" ? (p.display as Record<string, unknown>) : {}) as Record<string, unknown>;
  return {
    marquee: typeof d.marquee === "string" && d.marquee ? d.marquee : DEFAULTS.marquee,
    sponsors: Array.isArray(d.sponsors) ? (d.sponsors as unknown[]).filter((x): x is string => typeof x === "string") : DEFAULTS.sponsors,
    leaderboardMode: !!d.leaderboardMode,
  };
}

/** Subscribe to current_match.payload.display for a given session. */
export function useDisplaySettings(sessionCode: string | null): DisplaySettings {
  const [settings, setSettings] = useState<DisplaySettings>(DEFAULTS);

  useEffect(() => {
    if (!sessionCode) { setSettings(DEFAULTS); return; }
    let cancelled = false;

    supabase.from("current_match").select("payload").eq("session_code", sessionCode).maybeSingle()
      .then(({ data }) => { if (!cancelled && data) setSettings(extract((data as { payload?: unknown }).payload)); });

    const ch = supabase.channel(`display-${sessionCode}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "current_match", filter: `session_code=eq.${sessionCode}` },
        (payload: { new?: { payload?: unknown } }) => {
          if (payload.new) setSettings(extract(payload.new.payload));
        })
      .subscribe();

    return () => { cancelled = true; try { supabase.removeChannel(ch); } catch { /* ignore */ } };
  }, [sessionCode]);

  return settings;
}

/** Chief-only: merge new display settings into current_match.payload. */
export async function pushDisplaySettings(sessionCode: string, partial: Partial<DisplaySettings>): Promise<void> {
  const { data } = await supabase.from("current_match").select("payload").eq("session_code", sessionCode).maybeSingle();
  const prev = (data as { payload?: Record<string, unknown> } | null)?.payload ?? {};
  const prevDisplay = (prev.display && typeof prev.display === "object" ? prev.display : {}) as Record<string, unknown>;
  const nextDisplay = { ...prevDisplay, ...partial };
  const nextPayload = { ...prev, display: nextDisplay };

  // Try update first; if no row exists, upsert a minimal one so display has something to read.
  const upd = await supabase
    .from("current_match")
    .update({ payload: nextPayload as never, updated_at: new Date().toISOString() })
    .eq("session_code", sessionCode)
    .select("session_code");

  if (upd.error || !upd.data || upd.data.length === 0) {
    await supabase.from("current_match").upsert(
      { session_code: sessionCode, payload: nextPayload as never, updated_at: new Date().toISOString() } as never,
      { onConflict: "session_code" } as never,
    );
  }
}

/** Chief-only: upload a sponsor logo to public storage; returns public URL. */
export async function uploadSponsorLogo(file: File, sessionCode: string): Promise<string> {
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `sponsors/${sessionCode}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("match_clips").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "image/png",
  });
  if (error) throw error;
  const { data } = supabase.storage.from("match_clips").getPublicUrl(path);
  return data.publicUrl;
}
