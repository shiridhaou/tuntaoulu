import { useCallback } from "react";
import { useRouter } from "@tanstack/react-router";
import { useCompetition } from "@/store/competition-store";

/**
 * Full exit handler: clears the role/session context, wipes every taolu-prefixed
 * storage key, and navigates to root with NO search params so the session does not
 * auto-hydrate again on redirect or reload.
 */
export function useLogout() {
  const { logout } = useCompetition();
  const router = useRouter();

  return useCallback(() => {
    // 1) clear in-memory state first
    logout();

    // 2) wipe all app storage keys (local + session) — keep Supabase auth device session intact
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

    // 3) redirect to root with empty search params. Use router.navigate when
    //    available; otherwise fall back to a full location replace so the URL
    //    is guaranteed to be cleaned and the app state is fully reset.
    try {
      if (router?.navigate) {
        router.navigate({ to: "/", search: {}, replace: true });
      } else if (typeof window !== "undefined") {
        window.location.replace("/");
      }
    } catch { /* ignore */ }
  }, [logout, router]);
}
