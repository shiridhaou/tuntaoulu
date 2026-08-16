// Standard UUID helpers — the database rejects anything that isn't a canonical
// UUID (error 22P02), so never build ids with prefixes like `local-`.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim());
}

/** Returns the value when it is a valid UUID, otherwise null. */
export function cleanUuid(value: unknown): string | null {
  return isUuid(value) ? (value as string).trim() : null;
}

/** Always returns a valid UUID — falls back to a fresh v4. */
export function ensureUuid(value?: unknown): string {
  return cleanUuid(value) ?? newUuid();
}

export function newUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
