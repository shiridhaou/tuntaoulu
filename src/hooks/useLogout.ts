import { useCallback } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useCompetition } from "@/store/competition-store";

/**
 * Full exit handler: clears the role/session context, wipes every taolu-prefixed
 * storage key, and navigates to root with NO search params so the session does not
 * auto-hydrate again on redirect or reload.
 */
export function useLogout() {
  const { logout } = useCompetition();
  const navigate = useNavigate();
  const router = useRouter();

  return useCallback(() => {
    // 1) clear in-memory state first
    console.log("[useLogout] invoked");
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
      } catch (e) { console.error("[useLogout] storage wipe error", e); }
    }

    // 3) redirect to root with empty search params. Fall back to window.location
    //    if the router navigate is not available in this context.
    console.log("[useLogout] navigating, nav type:", typeof navigate, "router:", typeof router, "window:", typeof window);
    try {
      if (typeof navigate === "function") {
        const result = navigate({ to: "/", search: {}, replace: true });
        console.log("[useLogout] navigate result:", result);
        if (result && typeof result.then === "function") {
          result.then((v: unknown) => console.log("[useLogout] navigate resolved:", v)).catch((e: unknown) => console.error("[useLogout] navigate rejected:", e));
        }
      } else if (router?.navigate) {
        router.navigate({ to: "/", search: {}, replace: true });
        console.log("[useLogout] router.navigate() called");
      } else if (typeof window !== "undefined") {
        window.location.replace("/");
        console.log("[useLogout] window.location.replace called");
      }
    } catch (e) { console.error("[useLogout] navigation error", e); }
  }, [logout, navigate, router]);
}
