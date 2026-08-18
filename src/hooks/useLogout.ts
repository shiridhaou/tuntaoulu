import { useCallback } from "react";
import { useRouter } from "@tanstack/react-router";
import { useCompetition } from "@/store/competition-store";

/**
 * Full exit handler: wipes every taolu-prefixed storage key first, then
 * navigates to root with NO search params.
 *
 * The order matters: if we navigate to / before localStorage is cleared, the
 * role/session hydration on reload will immediately redirect back to the same
 * role screen. If we clear context state before navigation, the calling
 * component unmounts and can cancel the navigation. So storage is wiped first,
 * then the browser replaces the URL to /, and the context state is discarded
 * naturally by the page reload.
 */
export function useLogout() {
  const router = useRouter();

  return useCallback(() => {
    // 1) wipe all app storage keys (local + session) first — keep Supabase auth device session intact
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

    // 2) redirect to root with empty search params. Try TanStack navigation first,
    //    but always fall back to a full location replace so the exit is guaranteed.
    try {
      if (router?.navigate) {
        router.navigate({ to: "/", search: {}, replace: true });
      }
    } catch { /* ignore */ }
    if (typeof window !== "undefined") {
      window.location.replace("/");
    }
  }, [router]);
}
