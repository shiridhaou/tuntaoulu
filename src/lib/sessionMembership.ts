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

  // NEVER downgrade an existing role/slot: a later call without arguments
  // (e.g. setSessionCode) used to null out the Chief's role, which then broke
  // result publishing under RLS.
  const { data: existing } = await supabase
    .from("session_members")
    .select("role, slot")
    .eq("session_code", sessionCode)
    .eq("user_id", userId)
    .maybeSingle();

  const { error } = await supabase
    .from("session_members")
    .upsert(
      {
        session_code: sessionCode,
        user_id: userId,
        role: role ?? existing?.role ?? null,
        slot: slot ?? existing?.slot ?? null,
      },
      { onConflict: "session_code,user_id" },
    );
  if (error) console.warn("[session] membership registration failed", error.message);

}

/**
 * Guarantees a device identity exists before any session validation / join.
 * Without it, the very first read after joining can race an unauthenticated client.
 */
export async function ensureDeviceSession(): Promise<void> {
  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (data.session) return;
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}
