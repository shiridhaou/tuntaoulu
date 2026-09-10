/**
 * useAthleteImport.ts
 * ----------------------------------------------------------------------------
 * Encapsulates the Excel/CSV athlete-roster import flow: parsing the file,
 * holding the confirmation preview, and syncing accepted records to the
 * database in the background (local-first, with a retryable failure queue).
 *
 * This hook is intentionally decoupled from tournament-creation logic — it
 * takes a `resolveTournamentId` callback instead of knowing how a tournament
 * row gets created, so it can be reused/tested independently of that concern.
 * ----------------------------------------------------------------------------
 */

import { useCallback, useState } from "react";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cleanUuid, newUuid } from "@/lib/uuid";
import { normalizeRow, type NormalizedAthleteRow } from "@/lib/importParsing";

// ============================================================================
// Types
// ============================================================================

/** A parsed-and-confirmed athlete record, ready to be held in local state
 *  and (eventually) persisted to the `athletes` table. */
export type ImportedAthleteRecord = Omit<NormalizedAthleteRow, "_mode"> & {
  id: string;
  routine_mode: NormalizedAthleteRow["_mode"];
};

interface UseAthleteImportOptions {
  /**
   * Resolves (and lazily creates, if needed) a guaranteed-valid tournament
   * UUID to attach imported athletes to. Injected so this hook never needs
   * to know how/when a tournament row gets created.
   */
  resolveTournamentId: () => Promise<string | null>;
  /**
   * Called the moment imported records are accepted locally — i.e.
   * optimistically, before the background DB sync completes. Use this to
   * merge the records into whatever athlete list the caller owns.
   */
  onImported?: (records: ImportedAthleteRecord[]) => void;
}

interface UseAthleteImportResult {
  /** Parsed rows awaiting user confirmation, or null when no file is staged. */
  preview: NormalizedAthleteRow[] | null;
  /** True while a file is being parsed. */
  isImporting: boolean;
  /** Records accepted locally that have not yet synced to the DB. */
  unsynced: Record<string, unknown>[];
  /** True while a background sync (initial or retry) is in flight. */
  retrying: boolean;
  /** Parses a CSV/XLSX file and stages the result in `preview`. */
  processFile: (file: File, tournamentId: string) => Promise<void>;
  /** Accepts the current `preview` and starts the background DB sync. */
  confirmImport: () => void;
  /** Discards the current `preview` without persisting anything. */
  cancelImport: () => void;
  /** Re-attempts syncing any records currently in `unsynced`. */
  retryUnsynced: () => void;
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

export function useAthleteImport({
  resolveTournamentId,
  onImported,
}: UseAthleteImportOptions): UseAthleteImportResult {
  const [preview, setPreview] = useState<NormalizedAthleteRow[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // RC-7 (carried over) — records that live only in the local queue because
  // their background database sync failed. Surfaced as a non-blocking badge
  // with manual retry by the caller.
  const [unsynced, setUnsynced] = useState<Record<string, unknown>[]>([]);
  const [retrying, setRetrying] = useState(false);

  const processFile = useCallback(async (file: File, tournamentId: string) => {
    setIsImporting(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      let rows: any[] = [];
      if (ext === "csv") {
        // Force UTF-8 decoding (with BOM stripping) so Arabic names render correctly.
        const buf = await file.arrayBuffer();
        let text = new TextDecoder("utf-8").decode(buf);
        if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
        rows = (Papa.parse(text, { header: true, skipEmptyLines: true }).data) as any[];
      } else {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array", cellDates: true, codepage: 65001 });
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "", raw: false });
      }
      const records = rows.map((r) => normalizeRow(r, tournamentId)).filter((r) => r.full_name);
      if (!records.length) {
        toast.error("لا يوجد لاعبون صالحون في الملف");
        return;
      }

      // Nothing is committed until the user confirms — just stage the preview.
      setPreview(records);

      const compCount = records.filter((r) => r._mode === "compulsory").length;
      const optionalRecords = records.filter((r) => r._mode === "optional");
      const optCount = optionalRecords.length;
      const optionalMoves = optionalRecords.reduce((sum, r) => sum + r.difficulty_sheet.length, 0);
      const unsetCount = records.length - compCount - optCount;
      const moves = records.reduce((s, r) => s + (r.difficulty_sheet?.length ?? 0), 0);
      toast.success(
        `تمت قراءة ${records.length} لاعب — إلزامي: ${compCount} • اختياري: ${optionalMoves} حركة (${optCount} لاعب)` +
        (unsetCount ? ` • غير محدد: ${unsetCount}` : "") +
        (moves ? ` • ${moves} حركة صعوبة` : "") + " — راجع ثم اضغط تأكيد"
      );
    } catch (err: any) {
      toast.error(err.message ?? "فشل قراءة الملف");
    } finally {
      setIsImporting(false);
    }
  }, []);

  /**
   * RC-7 — background upsert with a visible, retryable failure state.
   * The local queue (owned by the caller via onImported) always stays
   * authoritative; this only reconciles the DB copy.
   */
  const syncRecords = useCallback(async (records: Record<string, unknown>[]) => {
    if (!records.length) return;
    setRetrying(true);
    try {
      // Never send a non-UUID tournament_id to the database (22P02).
      const tid = await resolveTournamentId();
      const { error } = await supabase
        .from("athletes")
        .upsert(records.map((r) => ({ ...r, tournament_id: tid })) as never, { onConflict: "id" });
      if (error) throw error;
      setUnsynced((prev) => {
        const ids = new Set(records.map((r) => String(r.id)));
        return prev.filter((r) => !ids.has(String(r.id)));
      });
    } catch (e: any) {
      console.warn("[athletes] background import sync failed — local queue kept", describeDbError(e));
      setUnsynced((prev) => {
        const ids = new Set(prev.map((r) => String(r.id)));
        return [...prev, ...records.filter((r) => !ids.has(String(r.id)))];
      });
    } finally {
      setRetrying(false);
    }
  }, [resolveTournamentId]);

  /**
   * Local-first import: parsed athletes are handed to the caller
   * (optimistic UI update) immediately; the database insert runs in the
   * background via syncRecords.
   */
  const persistRecords = useCallback((records: NormalizedAthleteRow[]) => {
    if (!records.length) return;

    // Strip the transient `_mode` field and assign a canonical UUID before
    // this record is stored or persisted anywhere.
    const clean: ImportedAthleteRecord[] = records.map(({ _mode, ...rest }) => ({
      ...rest,
      id: cleanUuid((rest as { id?: string }).id) ?? newUuid(),
      routine_mode: _mode,
    }));

    setPreview(null);
    toast.success(`تمت إضافة ${clean.length} لاعب إلى قائمة المباريات`);

    // 1) Hand off to the caller instantly (local queue + UI refresh).
    onImported?.(clean);

    // 2) Background database insert — never blocks the caller's UI.
    void syncRecords(clean.map(({ routine_mode, ...record }) => record) as unknown as Record<string, unknown>[]);
  }, [onImported, syncRecords]);

  const confirmImport = useCallback(() => {
    if (!preview) return;
    persistRecords(preview);
  }, [preview, persistRecords]);

  const cancelImport = useCallback(() => {
    setPreview(null);
  }, []);

  const retryUnsynced = useCallback(() => {
    void syncRecords(unsynced);
  }, [unsynced, syncRecords]);

  return {
    preview,
    isImporting,
    unsynced,
    retrying,
    processFile,
    confirmImport,
    cancelImport,
    retryUnsynced,
  };
}
