/**
 * groupCConsensus.ts — IWUF 2024 Group C majority rule (2 of 3).
 * Each C judge's raw YES/NO decisions stay stored independently in
 * judge_scores.payload.attempts; this pure module derives the consensus.
 */
import { MAX_C_MOVEMENT, MAX_C_CONNECTION } from "@/lib/difficultyCodes";

export interface GroupCAttempt {
  code: string;
  label?: string;
  value: number;
  successful: boolean;
  kind?: "movement" | "connection";
}

export interface GroupCRow {
  judge_slot: string;
  judge_role: string;
  athlete_id: string | null;
  score: number | null;
  submitted: boolean;
  payload: { attempts?: GroupCAttempt[] } | null;
  updated_at?: string;
}

export type Vote = "YES" | "NO";
export type ChiefOverride = "YES" | "NO";

export interface GroupCItem {
  key: string;
  code: string;
  label: string;
  value: number;
  kind: "movement" | "connection";
  votes: Record<string, Vote>;
  yes: number;
  no: number;
  /** Majority outcome, "SPLIT" when no absolute majority exists. */
  majority: Vote | "SPLIT";
  override: ChiefOverride | null;
  /** Final decision after any Chief override. */
  decision: Vote | "SPLIT";
  /** Slots whose vote was overridden by the majority. */
  minority: string[];
}

export interface GroupCConsensus {
  items: GroupCItem[];
  slots: string[];
  /** Consensus score, or null when fewer than 2 judges sent decisions. */
  score: number | null;
}

const r3 = (n: number) => Number(n.toFixed(3));

export function computeGroupCConsensus(
  rows: GroupCRow[],
  athleteId: string | null,
  overrides: Record<string, ChiefOverride> = {},
): GroupCConsensus {
  // Latest row per slot for this athlete — a formal submission beats a live one.
  const bySlot = new Map<string, GroupCRow>();
  for (const r of rows) {
    if (r.judge_role !== "C") continue;
    if (athleteId && r.athlete_id && r.athlete_id !== athleteId) continue;
    const attempts = r.payload?.attempts;
    if (!Array.isArray(attempts) || attempts.length === 0) continue;
    const prev = bySlot.get(r.judge_slot);
    if (!prev || (r.submitted && !prev.submitted) ||
        (r.submitted === prev.submitted && (r.updated_at ?? "") > (prev.updated_at ?? ""))) {
      bySlot.set(r.judge_slot, r);
    }
  }
  const slots = [...bySlot.keys()].sort();
  const map = new Map<string, GroupCItem>();
  const order: string[] = [];

  for (const slot of slots) {
    const seen: Record<string, number> = {};
    for (const a of bySlot.get(slot)!.payload!.attempts!) {
      const code = String(a.code ?? "").trim().toUpperCase();
      if (!code) continue;
      seen[code] = (seen[code] ?? 0) + 1;
      const key = `${code}#${seen[code]}`;
      let item = map.get(key);
      if (!item) {
        item = {
          key, code, label: a.label ?? code, value: Number(a.value) || 0,
          kind: a.kind === "connection" ? "connection" : "movement",
          votes: {}, yes: 0, no: 0, majority: "SPLIT", override: null, decision: "SPLIT", minority: [],
        };
        map.set(key, item);
        order.push(key);
      }
      item.votes[slot] = a.successful ? "YES" : "NO";
    }
  }

  const needed = Math.floor(slots.length / 2) + 1; // 3 judges → 2
  let mov = 0, conn = 0;
  const items = order.map((k) => {
    const it = map.get(k)!;
    const vs = Object.entries(it.votes);
    it.yes = vs.filter(([, v]) => v === "YES").length;
    it.no = vs.length - it.yes;
    it.majority = it.yes >= needed ? "YES" : it.no >= needed ? "NO" : "SPLIT";
    it.override = overrides[k] ?? null;
    it.decision = it.override ?? it.majority;
    it.minority = it.majority === "SPLIT" ? [] : vs.filter(([, v]) => v !== it.majority).map(([s]) => s);
    if (it.decision === "YES") {
      if (it.kind === "connection") conn += it.value; else mov += it.value;
    }
    return it;
  });

  const score = slots.length >= 2
    ? r3(Math.min(mov, MAX_C_MOVEMENT) + Math.min(conn, MAX_C_CONNECTION))
    : null;
  return { items, slots, score };
}
