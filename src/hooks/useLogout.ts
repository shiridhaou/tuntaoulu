import { useCallback } from "react";
import { useRouter } from "@tanstack/react-router";
import { useCompetition } from "@/store/competition-store";

/**
 * Full exit handler: clears the role/session context, wipes every taolu-prefixed
 * storage key, and navigates to root with NO search params so the session does not
 * auto-hydrate again on redirect or reload.
 *
 * Note: we use a hard location.replace() here because TanStack Router's
 * router.navigate() can be suppressed when the calling component is unmounted
 * by the preceding logout() state change. A full reload to / is the safest
 * way to guarantee a clean exit state.
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

    // 3) redirect to root with empty search params. Try router.navigate first,
    //    but always fall back to window.location.replace so the exit is guaranteed.
    try {
      if (router?.navigate) {
        router.navigate({ to: "/", search: {}, replace: true });
      }
    } catch { /* ignore */ }
    if (typeof window !== "undefined") {
      window.location.replace("/");
    }
  }, [logout, router]);
}
