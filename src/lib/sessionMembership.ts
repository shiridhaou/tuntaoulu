import { supabase } from "@/integrations/supabase/client";

/**
 * SECURITY: writing match data requires a real membership row proving this
 * device actually joined the (active) session — an active session code alone
 * is no longer a write permission.
 */
export async function joinSessionMembership(
  sessionCode: string,
  role?: string | null,
  slot?: string | null,
): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id;
  if (!userId || !sessionCode) return;

  const { error } = await supabase
    .from("session_members")
    .upsert(
      { session_code: sessionCode, user_id: userId, role: role ?? null, slot: slot ?? null },
      { onConflict: "session_code,user_id" },
    );
  if (error) console.warn("[session] membership registration failed", error.message);
}
