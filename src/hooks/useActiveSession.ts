import { useEffect, useState } from "react";

const STORAGE_KEY = "taolu.sessionCode";

/** Canonical form of a session code: trimmed + uppercase. */
export function canonicalSessionCode(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim().toUpperCase();
  return v || null;
}

/** Read the active session code from URL (?session=) then localStorage. */
export function readActiveSessionCode(): string | null {
  if (typeof window === "undefined") return null;
  const fromUrl = canonicalSessionCode(new URLSearchParams(window.location.search).get("session"));
  if (fromUrl) return fromUrl;
  return canonicalSessionCode(window.localStorage.getItem(STORAGE_KEY));
}

/**
 * Hydration-safe accessor for the active session code.
 * Persists a URL-provided code so later reads (score submission) always find it.
 * Read-only with respect to sync logic — it never touches realtime channels.
 */
export function useActiveSessionCode(preferred?: string | null): string | null {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    const pref = canonicalSessionCode(preferred);
    const resolved = pref ?? readActiveSessionCode();
    if (resolved && typeof window !== "undefined") {
      try {
        if (window.localStorage.getItem(STORAGE_KEY) !== resolved) {
          window.localStorage.setItem(STORAGE_KEY, resolved);
        }
      } catch { /* storage may be unavailable */ }
    }
    setCode(resolved);
  }, [preferred]);

  return code;
}
