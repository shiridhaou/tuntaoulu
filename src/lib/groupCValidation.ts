/**
 * groupCValidation.ts
 * ----------------------------------------------------------------------------
 * IWUF Group C form validation for the Technical Assistant panel.
 *
 * Checks a difficulty sequence (movements + connection/landing slots) against
 * the athlete's discipline:
 *   · movement difficulty total  ≤ 1.40
 *   · connection difficulty total ≤ 0.60
 *   · connection slot codes (0 … 11 / "+") allowed for that discipline
 *   · every connection is attached to a preceding difficulty movement
 *
 * Pure functions only — no UI, no network, no side effects.
 * ----------------------------------------------------------------------------
 */

import {
  MAX_C_MOVEMENT,
  MAX_C_CONNECTION,
  isConnectionCode,
  parseNumericConnection,
  parsePlusConnection,
} from "@/lib/difficultyCodes";
import { normalizeStyle, type StyleKey } from "@/lib/styleNames";

export interface ValidatableItem {
  code: string;
  label?: string;
  value?: number;
}

export type IssueSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: IssueSeverity;
  /** 1-based position in the sequence, or null for whole-sheet issues. */
  position: number | null;
  code: string | null;
  message: string;
}

export interface GroupCValidationResult {
  style: StyleKey;
  movementTotal: number;
  connectionTotal: number;
  movementCount: number;
  connectionCount: number;
  issues: ValidationIssue[];
  /** True when there is no blocking (error) issue. */
  valid: boolean;
}

/**
 * Connection / landing slots accepted per discipline (IWUF 2024 tables).
 * Taijiquan routines have no run-up/kick landing chains 8 … 11.
 */
const ALLOWED_SLOTS: Record<StyleKey, number[]> = {
  changquan: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  nanquan: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  taijiquan: [0, 1, 2, 3, 4, 5, 6, 7],
  traditional: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function validateDifficultySheet(
  sheet: ValidatableItem[],
  rawStyle?: string | null,
): GroupCValidationResult {
  const style = normalizeStyle(rawStyle);
  const allowed = ALLOWED_SLOTS[style];
  const issues: ValidationIssue[] = [];

  let movementTotal = 0;
  let connectionTotal = 0;
  let movementCount = 0;
  let connectionCount = 0;
  let sawMovement = false;

  sheet.forEach((item, i) => {
    const code = String(item.code ?? "").trim().toUpperCase();
    const value = Number(item.value ?? 0) || 0;
    const pos = i + 1;
    if (!code) {
      issues.push({ severity: "error", position: pos, code: null, message: "خانة بدون كود" });
      return;
    }

    if (isConnectionCode(code)) {
      connectionCount += 1;
      connectionTotal += value;

      const numeric = parseNumericConnection(code);
      const plus = parsePlusConnection(code);
      const slot = numeric
        ? numeric.ordinal
        : plus && /^\d{1,2}$/.test(plus.suffix)
          ? parseInt(plus.suffix, 10)
          : null;

      if (slot !== null && !allowed.includes(slot)) {
        issues.push({
          severity: "error",
          position: pos,
          code,
          message: `كود الربط "${code}" غير معتمد في هذا الأسلوب`,
        });
      }
      if (!sawMovement) {
        issues.push({
          severity: "error",
          position: pos,
          code,
          message: `عنصر ربط "${code}" بدون حركة صعوبة سابقة`,
        });
      }
      return;
    }

    movementCount += 1;
    movementTotal += value;
    sawMovement = true;

    if (!/^\d{3}[A-C]$/.test(code)) {
      issues.push({
        severity: "warning",
        position: pos,
        code,
        message: `كود الحركة "${code}" لا يطابق الصيغة الرسمية (مثال 323A)`,
      });
    }
  });

  movementTotal = round2(movementTotal);
  connectionTotal = round2(connectionTotal);

  if (movementTotal > MAX_C_MOVEMENT + 1e-9) {
    issues.push({
      severity: "error",
      position: null,
      code: null,
      message: `مجموع الصعوبات ${movementTotal.toFixed(2)} يتجاوز الحد الأقصى ${MAX_C_MOVEMENT.toFixed(2)}`,
    });
  }
  if (connectionTotal > MAX_C_CONNECTION + 1e-9) {
    issues.push({
      severity: "error",
      position: null,
      code: null,
      message: `مجموع الربط ${connectionTotal.toFixed(2)} يتجاوز الحد الأقصى ${MAX_C_CONNECTION.toFixed(2)}`,
    });
  }

  return {
    style,
    movementTotal,
    connectionTotal,
    movementCount,
    connectionCount,
    issues,
    valid: !issues.some((x) => x.severity === "error"),
  };
}
