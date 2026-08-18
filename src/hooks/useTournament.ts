/**
 * useTournament.ts
 * ----------------------------------------------------------------------------
 * Encapsulates tournament setup: loading the active tournament for a session
 * (with a localStorage fallback for offline resilience), the local-first
 * save flow, and `resolveTournamentId` — a guaranteed-valid tournament UUID
 * used by anything that needs to attach a row to this tournament (athlete
 * import, manual athlete add) without needing to know how tournaments are
 * created.
 * ----------------------------------------------------------------------------
 */

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ensureDeviceSession, joinSessionMembership } from "@/lib/sessionMembership";
import { cleanUuid, newUuid } from "@/lib/uuid";

// ============================================================================
// Types
// ============================================================================

export interface Tournament {
  id: string;
  name: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  active: boolean;
  session_code: string | null;
}

export interface TournamentFormState {
  name: string;
  location: string;
  start_date: string;
  end_date: string;
}

const EMPTY_FORM: TournamentFormState = { name: "", location: "", start_date: "", end_date: "" };

interface UseTournamentOptions {
  sessionCode: string | null;
}

interface UseTournamentResult {
  tournament: Tournament | null;
  form: TournamentFormState;
  setForm: React.Dispatch<React.SetStateAction<TournamentFormState>>;
  /** Fetches the active tournament for this session (DB, falling back to the
   *  local cache when offline), updates local state + form, and returns it. */
  reloadTournament: () => Promise<Tournament | null>;
  /** Local-first save: commits to local state + localStorage instantly (so
   *  the UI never blocks on the network), then syncs to the DB in the
   *  background. Requires `form.name` to be set. */
  saveTournament: () => void;
  /**
   * Returns a tournament_id guaranteed to be a canonical UUID that exists in
   * the DB — creating the row first if needed. Never throws; resolves to
   * null on failure so callers can degrade to unlinked records instead of
   * blocking (mirrors the original dashboard's fault-tolerant import path).
   */
  resolveTournamentId: () => Promise<string | null>;
}

// ============================================================================
// Helpers
// ============================================================================

function describeDbError(e: any): string {
  const parts = [e?.message, e?.details, e?.hint, e?.code ? `code=${e.code}` : null].filter(Boolean);
  return parts.join(" — ") || "خطأ غير معروف";
}

// ============================================================================
// Hook
// ============================================================================

export function useTournament({ sessionCode }: UseTournamentOptions): UseTournamentResult {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [form, setForm] = useState<TournamentFormState>(EMPTY_FORM);

  const localKey = useCallback(() => `ta:tournament:${sessionCode ?? "none"}`, [sessionCode]);

  const readLocal = useCallback((): Tournament | null => {
    try {
      const raw = localStorage.getItem(localKey());
      return raw ? (JSON.parse(raw) as Tournament) : null;
    } catch {
      return null;
    }
  }, [localKey]);

  const writeLocal = useCallback((t: Tournament | null) => {
    try {
      if (t) localStorage.setItem(localKey(), JSON.stringify(t));
      else localStorage.removeItem(localKey());
    } catch {
      /* storage unavailable — local context still holds the value */
    }
  }, [localKey]);

  const reloadTournament = useCallback(async (): Promise<Tournament | null> => {
    if (!sessionCode) return null;
    const { data: t } = await supabase
      .from("tournaments").select("*").eq("session_code", sessionCode)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (t) {
      const row = t as Tournament;
      setTournament(row);
      writeLocal(row);
      setForm({
        name: row.name, location: row.location ?? "",
        start_date: row.start_date ?? "", end_date: row.end_date ?? "",
      });
      return row;
    }

    const local = readLocal();
    if (local) {
      setTournament(local);
      setForm({
        name: local.name, location: local.location ?? "",
        start_date: local.start_date ?? "", end_date: local.end_date ?? "",
      });
      return local;
    }
    return null;
  }, [sessionCode, readLocal, writeLocal]);

  /**
   * Local-first: the form is committed to local context + localStorage right
   * away, then pushed to the database in the background. Database problems
   * are logged but never block the panel — callers observe this by simply
   * reading `tournament`, which updates instantly regardless of network state.
   */
  const saveTournament = useCallback(() => {
    if (!form.name.trim()) { toast.error("اسم البطولة مطلوب"); return; }

    const payload = {
      name: form.name.trim(),
      location: form.location.trim() || null,
      start_date: form.start_date.trim() || null,
      end_date: form.end_date.trim() || null,
      session_code: sessionCode,
      active: true,
    };

    const isNew = !tournament;
    const localTournament = {
      // MUST be a canonical UUID — prefixed ids break every FK insert (22P02).
      id: cleanUuid(tournament?.id) ?? newUuid(),
      ...payload,
      created_at: (tournament as any)?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as Tournament;

    setTournament(localTournament);
    writeLocal(localTournament);
    toast.success(isNew ? "تم إنشاء البطولة" : "تم تحديث البطولة");

    void (async () => {
      try {
        await ensureDeviceSession();
        await joinSessionMembership(sessionCode ?? "", "technical-assistant");
        const { data, error } = await supabase
          .from("tournaments")
          .upsert({ id: localTournament.id, ...payload }, { onConflict: "id" })
          .select().single();
        if (error) throw error;
        if (data) {
          setTournament(data as Tournament);
          writeLocal(data as Tournament);
        }
      } catch (e: any) {
        console.warn("[tournaments] background sync failed — local context kept", describeDbError(e));
      }
    })();
  }, [form, tournament, sessionCode, writeLocal]);

  /**
   * Returns a tournament_id that is guaranteed to be a canonical UUID AND to
   * exist in the database, so athlete inserts never hit 22P02 or an FK error.
   * Falls back to `null` (unlinked athletes) instead of blocking the caller.
   */
  const resolveTournamentId = useCallback(async (): Promise<string | null> => {
    const id = cleanUuid(tournament?.id) ?? newUuid();
    try {
      const { data: existing } = await supabase
        .from("tournaments").select("id").eq("id", id).maybeSingle();
      if (existing) return id;

      await ensureDeviceSession();
      await joinSessionMembership(sessionCode ?? "", "technical-assistant");
      const { data: created, error } = await supabase.from("tournaments").insert({
        id,
        name: tournament?.name || form.name.trim() || "بطولة",
        location: tournament?.location ?? (form.location.trim() || null),
        start_date: tournament?.start_date ?? (form.start_date.trim() || null),
        end_date: tournament?.end_date ?? (form.end_date.trim() || null),
        session_code: sessionCode,
        active: true,
      }).select().single();
      if (error) throw error;
      setTournament(created as Tournament);
      return id;
    } catch (e) {
      console.error("[tournaments] could not materialize tournament row", e);
      return null;
    }
  }, [tournament, form, sessionCode]);

  return { tournament, form, setForm, reloadTournament, saveTournament, resolveTournamentId };
}
