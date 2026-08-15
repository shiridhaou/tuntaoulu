/**
 * Results export webhook (UI-level integration only).
 *
 * The Technical Assistant can register an external endpoint (federation live
 * site, broadcast overlay, …). Whenever a final score is published, a JSON
 * payload is POSTed to that endpoint. Settings are stored per session in
 * localStorage — no database schema is touched.
 */

export interface WebhookSettings {
  enabled: boolean;
  url: string;
}

export interface ResultWebhookPayload {
  tournamentId: string | null;
  athleteName: string | null;
  team: string | null;
  style: string | null;
  difficultyScore: number | null;
  deductionScore: number | null;
  finalScore: number | null;
  timestamp: string;
}

const KEY = (sessionCode: string) => `wushu.webhook.${sessionCode}`;

export function getWebhookSettings(sessionCode: string | null): WebhookSettings {
  if (!sessionCode || typeof window === "undefined") return { enabled: false, url: "" };
  try {
    const raw = window.localStorage.getItem(KEY(sessionCode));
    if (!raw) return { enabled: false, url: "" };
    const p = JSON.parse(raw) as Partial<WebhookSettings>;
    return { enabled: !!p.enabled, url: typeof p.url === "string" ? p.url : "" };
  } catch {
    return { enabled: false, url: "" };
  }
}

export function saveWebhookSettings(sessionCode: string | null, s: WebhookSettings) {
  if (!sessionCode || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY(sessionCode), JSON.stringify(s));
  } catch { /* storage unavailable — ignore */ }
}

export function isValidWebhookUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Fire-and-forget POST. Never throws — a broken endpoint must not block
 * publishing a score. Returns true when the request was dispatched.
 */
export async function sendResultWebhook(
  sessionCode: string | null,
  payload: ResultWebhookPayload,
): Promise<boolean> {
  const settings = getWebhookSettings(sessionCode);
  if (!settings.enabled || !isValidWebhookUrl(settings.url)) return false;
  try {
    await fetch(settings.url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return true;
  } catch (e) {
    console.warn("[WEBHOOK] delivery failed", e);
    return false;
  }
}
