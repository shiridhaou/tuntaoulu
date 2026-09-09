/**
 * useDifficultySheet.ts
 * ----------------------------------------------------------------------------
 * Encapsulates the Group-C "difficulty sheet" for a single athlete (live or
 * up-next): local-first loading (DB row, falling back to whatever sheet was
 * parsed at import time for athletes not yet synced), row editing, manual
 * save, and the auto-push broadcast to Group-C judges via `current_match`.
 *
 * Deliberately decoupled from the dashboard's full `Athlete` type — this
 * hook only reads `id` / `difficulty_sheet` / `difficulty_codes`, so any
 * object with those fields can be passed in without a cast.
 * ----------------------------------------------------------------------------
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { broadcastSessionState } from "@/hooks/useMatchSync";
import type { DifficultyItem } from "@/lib/importParsing";
import { isConnectionCode } from "@/lib/difficultyCodes";

// ============================================================================
// Types
// ============================================================================

export interface DifficultySheetSourceAthlete {
  id: string;
  difficulty_sheet?: DifficultyItem[] | null;
  difficulty_codes?: string[] | null;
}

interface UseDifficultySheetOptions {
  sessionCode: string | null;
  /** The athlete whose Group-C sheet is being managed (live or up-next), or
   *  null when no athlete is targeted. */
  targetAthlete: DifficultySheetSourceAthlete | null;
  /** Whether this athlete is currently on the mat. Kept as an input so the
   *  auto-push effect's dependency list mirrors the original behavior
   *  exactly (auto-push re-evaluates when live status flips). */
  isLive: boolean;
  /** Called after every successful save (silent save or broadcast push). */
  onSaved?: () => void;
  /** When false, the automatic broadcast is held back (e.g. the form failed
   *  IWUF validation and the TA has not overridden it yet). */
  allowAutoPush?: boolean;
}

interface UseDifficultySheetResult {
  sheet: DifficultyItem[];
  total: number;
  /** True once the current sheet has been broadcast to Group-C judges. */
  pushed: boolean;
  /** True while a save/push request is in flight. */
  saving: boolean;
  addRow: (code: string, label: string, value: number) => void;
  removeRow: (index: number) => void;
  updateRow: (index: number, patch: Partial<DifficultyItem>) => void;
  /** Persists the sheet to the athlete row; when `broadcastNow` is true it
   *  also pushes the sheet live to Group-C judges via current_match. */
  saveSheet: (broadcastNow: boolean) => Promise<void>;
}

// ============================================================================
// Hook
// ============================================================================

export function useDifficultySheet({
  sessionCode,
  targetAthlete,
  isLive,
  onSaved,
  allowAutoPush = true,
}: UseDifficultySheetOptions): UseDifficultySheetResult {
  const [sheet, setSheet] = useState<DifficultyItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [pushed, setPushed] = useState(false);

  // Guards so the load effect and the auto-push effect each fire once per
  // athlete, not on every unrelated re-render.
  const lastIdRef = useRef<string | null>(null);
  const autoPushRef = useRef<string | null>(null);

  // Load the sheet when the target athlete changes.
  useEffect(() => {
    if (!targetAthlete) { setSheet([]); lastIdRef.current = null; return; }
    if (lastIdRef.current === targetAthlete.id) return;
    lastIdRef.current = targetAthlete.id;
    setPushed(false);
    void (async () => {
      const { data } = await supabase
        .from("athletes").select("difficulty_codes, difficulty_sheet")
        .eq("id", targetAthlete.id).maybeSingle();
      // Locally-imported athletes may not exist in the DB yet — fall back to
      // the sheet parsed from the import file and held in the local queue.
      const curated = ((data as any)?.difficulty_sheet
        ?? targetAthlete.difficulty_sheet) as DifficultyItem[] | null;
      const codes = ((data as any)?.difficulty_codes
        ?? targetAthlete.difficulty_codes) as string[] | null;
      if (Array.isArray(curated) && curated.length > 0) {
        setSheet(curated.map((d: any) => ({
          code: String(d.code ?? "").toUpperCase(),
          label: String(d.label ?? d.code ?? ""),
          value: Number(d.value ?? 0),
        })));
      } else if (codes && codes.length) {
        const { buildDifficultySheet } = await import("@/lib/difficultyCodes");
        setSheet(buildDifficultySheet(codes) as DifficultyItem[]);
      } else {
        setSheet([]);
      }
    })();
  }, [targetAthlete?.id]);

  const total = useMemo(
    () => sheet.reduce((s, d) => s + (Number(d.value) || 0), 0),
    [sheet],
  );

  const addRow = useCallback((code: string, label: string, value: number) => {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) { toast.error("أدخل كود الحركة"); return; }
    // Connection nodes ("+", "+0.10", "+6" …) may legitimately repeat between movements.
    const isConnection = isConnectionCode(normalizedCode);
    if (!isConnection && sheet.some((d) => d.code === normalizedCode)) {
      toast.error("هذا الكود موجود مسبقاً"); return;
    }
    setSheet((arr) => [...arr, {
      code: normalizedCode,
      label: label.trim() || normalizedCode,
      value: isFinite(value) ? value : 0.2,
    }]);
    setPushed(false);
  }, [sheet]);

  const removeRow = useCallback((index: number) => {
    setSheet((arr) => arr.filter((_, idx) => idx !== index));
    setPushed(false);
  }, []);

  const updateRow = useCallback((index: number, patch: Partial<DifficultyItem>) => {
    setSheet((arr) => arr.map((d, idx) => idx === index ? { ...d, ...patch } : d));
    setPushed(false);
  }, []);

  const saveSheet = useCallback(async (broadcastNow: boolean) => {
    if (!targetAthlete) return;
    setSaving(true);
    try {
      const clean = sheet.map((d) => ({
        code: String(d.code).toUpperCase().trim(),
        label: String(d.label || d.code),
        value: Math.round(Number(d.value || 0) * 100) / 100,
      })).filter((d) => d.code);

      const codes = clean.map((d) => d.code);

      const { error } = await supabase.from("athletes")
        .update({ difficulty_sheet: clean as never, difficulty_codes: codes })
        .eq("id", targetAthlete.id);
      if (error) throw error;

      if (broadcastNow && sessionCode) {
        // Update the live current_match payload so all C judges receive immediately.
        const { data: existing } = await supabase
          .from("current_match").select("payload, athlete_id, style")
          .eq("session_code", sessionCode).maybeSingle();
        const prevPayload = (existing?.payload as Record<string, unknown> | null) ?? {};
        await supabase.from("current_match").upsert({
          session_code: sessionCode,
          athlete_id: existing?.athlete_id ?? targetAthlete.id,
          style: (existing as any)?.style ?? null,
          payload: { ...prevPayload, difficultySheet: clean, movements: clean } as never,
          updated_at: new Date().toISOString(),
        }, { onConflict: "session_code" });
        await supabase.from("match_events").insert({
          session_code: sessionCode,
          event_type: "difficulty_pushed",
          payload: { athlete_id: targetAthlete.id, count: clean.length, total },
        });
        await broadcastSessionState(sessionCode, {
          payload: { difficultySheet: clean, movements: clean },
        });
        setPushed(true);
        toast.success(`📤 تم دفع ${clean.length} حركة إلى حكام المجموعة C`);
      } else {
        toast.success("تم الحفظ — سيتم الدفع عند بدء المباراة");
      }
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message ?? "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  }, [targetAthlete, sheet, sessionCode, total, onSaved]);

  // AUTO-PUSH — as soon as a live (or up-next) athlete's sheet is available,
  // broadcast it to the Group-C judges (no manual tap required). Guarded per
  // athlete so it fires exactly once per athlete, not on every sheet edit.
  useEffect(() => {
    if (!targetAthlete || !sessionCode) return;
    if (sheet.length === 0) return;
    if (!allowAutoPush) return;
    if (autoPushRef.current === targetAthlete.id) return;
    autoPushRef.current = targetAthlete.id;
    void saveSheet(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetAthlete?.id, isLive, sessionCode, sheet.length, allowAutoPush]);

  return { sheet, total, pushed, saving, addRow, removeRow, updateRow, saveSheet };
}
