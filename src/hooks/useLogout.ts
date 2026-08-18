import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useCompetition } from "@/store/competition-store";

/**
 * Full exit handler: clears the role/session context, wipes every taolu-prefixed
 * storage key, and navigates to root with NO search params so the session does not
 * auto-hydrate again on redirect or reload.
 */
export function useLogout() {
  const { logout } = useCompetition();
  const navigate = useNavigate();

  return useCallback(() => {
    console.log("[useLogout] invoked");
    // 1) redirect to root with empty search params first (before state changes unmount the caller)
    console.log("[useLogout] navigating to /");
    navigate({ to: "/", search: {}, replace: true });
    console.log("[useLogout] navigate dispatched");

    // 2) clear in-memory state
    logout();

    // 3) wipe all app storage keys (local + session) — keep Supabase auth device session intact
    if (typeof window !== "undefined") {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (
            key?.startsWith("taolu.") ||
            key?.startsWith("wushu.") ||
            key?.startsWith("ta:")
          ) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => window.localStorage.removeItem(key));
        window.sessionStorage.removeItem("taolu.tab");
      } catch { /* ignore */ }
    }
  }, [logout, navigate]);
}
