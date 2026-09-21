import jsPDF from "jspdf";

export interface ScoreSheetData {
  // Athlete
  athleteName: string;
  bibNumber: string | null;
  club: string | null;
  country: string | null;
  category: string | null;
  // Match
  style: string | null;
  matchMode: "compulsory" | "optional";
  sessionCode: string | null;
  performanceTime: number; // sec elapsed
  // Group A — codes (consensus filtered)
  aConfirmedCodes: { code: string; count: number; slots: string[] }[];
  aFlaggedCodes: { code: string; slot: string }[];
  groupAScore: number; // final Group A after deductions
  groupAMax: number;
  // Group B
  bIndividualScores: { slot: string; score: number | null; role: "high" | "low" | "kept" | "single" }[];
  groupBAverage: number;
  groupBMax: number;
  // Group C
  cMovements: { code: string; label: string; connection: string; value: number; successful?: boolean }[];
  groupCScore: number;
  groupCMax: number;
  // TA
  taOobCount: number;
  taDeduction: number;
  // Chief Judge
  chiefDeduction: number;
  // Final
  finalScore: number;
  committedAt: number;
}

const NAVY = "#0A192F";
const GOLD = "#D4AF37";
const ORANGE = "#FF7A1A";
const GREEN = "#10B981";
const RED = "#EF4444";
const GREY = "#6B7280";

function fmt(n: number, d = 3) {
  return Number.isFinite(n) ? n.toFixed(d) : "—";
}

/**
 * Build a programmatic, text-based "Final Score Sheet" PDF and return a Blob.
 * Layout: A4 portrait, single page when content fits, auto-paginates otherwise.
 */
export function buildScoreSheetPdf(d: ScoreSheetData): { blob: Blob; filename: string } {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  const ensure = (needed: number) => {
    if (y + needed > pageH - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  // ── Header band ──────────────────────────────────────────
  pdf.setFillColor(NAVY);
  pdf.rect(0, 0, pageW, 28, "F");
  pdf.setTextColor(GOLD);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("FINAL SCORE SHEET", margin, 12);
  pdf.setFontSize(9);
  pdf.setTextColor("#ffffff");
  pdf.text("Tunisian Wushu Federation · Official Result", margin, 18);
  pdf.setFontSize(8);
  pdf.setTextColor("#9ca3af");
  pdf.text(
    `Issued: ${new Date(d.committedAt).toLocaleString("en-GB")}  ·  Session: ${d.sessionCode ?? "—"}`,
    margin,
    23,
  );
  // Final score badge top-right
  pdf.setFillColor(GOLD);
  pdf.roundedRect(pageW - margin - 50, 4, 50, 20, 2, 2, "F");
  pdf.setTextColor(NAVY);
  pdf.setFontSize(8);
  pdf.text("FINAL", pageW - margin - 46, 10);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text(fmt(d.finalScore), pageW - margin - 46, 20);
  y = 36;

  // ── Athlete card ─────────────────────────────────────────
  pdf.setDrawColor(GOLD);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(margin, y, pageW - 2 * margin, 24, 1.5, 1.5);
  pdf.setTextColor(NAVY);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text(d.athleteName || "—", margin + 4, y + 8);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(GREY);
  const athleteLine = [
    d.bibNumber ? `Bib #${d.bibNumber}` : null,
    d.country,
    d.club,
    d.category,
  ].filter(Boolean).join("   ·   ");
  pdf.text(athleteLine || "—", margin + 4, y + 14);
  pdf.setFontSize(8);
  pdf.setTextColor(ORANGE);
  pdf.text(
    `Style: ${d.style ?? "—"}   ·   Mode: ${d.matchMode.toUpperCase()}   ·   Time: ${Math.floor(d.performanceTime / 60)}:${String(d.performanceTime % 60).padStart(2, "0")}`,
    margin + 4,
    y + 20,
  );
  y += 30;

  // ── Section helper ───────────────────────────────────────
  const section = (title: string, accent = NAVY) => {
    ensure(10);
    pdf.setFillColor(accent);
    pdf.rect(margin, y, pageW - 2 * margin, 6, "F");
    pdf.setTextColor("#ffffff");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text(title, margin + 2, y + 4.2);
    y += 8;
  };

  const kv = (label: string, value: string, valueColor = NAVY) => {
    ensure(5);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(GREY);
    pdf.text(label, margin + 2, y);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(valueColor);
    pdf.text(value, pageW - margin - 2, y, { align: "right" });
    y += 5;
  };

  // ── GROUP A ──────────────────────────────────────────────
  section("GROUP A · QUALITY (CONSENSUS CODES)", NAVY);
  kv("Group A score", `${fmt(d.groupAScore)} / ${fmt(d.groupAMax)}`, GREEN);

  ensure(6);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(GREEN);
  pdf.text("Confirmed (≥2 judges):", margin + 2, y);
  y += 4;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.setTextColor(NAVY);
  if (d.aConfirmedCodes.length === 0) {
    pdf.setTextColor(GREY);
    pdf.text("— none —", margin + 4, y);
    y += 4;
  } else {
    const lines = d.aConfirmedCodes.map(c => `${c.code} ×${c.count}  (${c.slots.join(", ")})`);
    const wrapped = pdf.splitTextToSize(lines.join("    "), pageW - 2 * margin - 4);
    wrapped.forEach((line: string) => {
      ensure(4);
      pdf.text(line, margin + 4, y);
      y += 4;
    });
  }

  if (d.aFlaggedCodes.length > 0) {
    ensure(6);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(RED);
    pdf.text("Flagged (single judge — discarded):", margin + 2, y);
    y += 4;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(GREY);
    const lines = d.aFlaggedCodes.map(f => `${f.code} (${f.slot})`).join("    ");
    const wrapped = pdf.splitTextToSize(lines, pageW - 2 * margin - 4);
    wrapped.forEach((line: string) => {
      ensure(4);
      pdf.text(line, margin + 4, y);
      y += 4;
    });
  }
  y += 2;

  // ── GROUP B ──────────────────────────────────────────────
  section("GROUP B · PERFORMANCE (INDIVIDUAL SCORES)", NAVY);
  kv("Group B average (trimmed)", `${fmt(d.groupBAverage)} / ${fmt(d.groupBMax)}`, GREEN);

  ensure(6);
  // Mini table header
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(NAVY);
  pdf.text("Slot", margin + 2, y);
  pdf.text("Score", margin + 35, y);
  pdf.text("Role", margin + 65, y);
  y += 3;
  pdf.setDrawColor("#e5e7eb");
  pdf.line(margin, y, pageW - margin, y);
  y += 3;
  pdf.setFont("helvetica", "normal");
  if (d.bIndividualScores.length === 0) {
    pdf.setTextColor(GREY);
    pdf.text("— no Group B submissions —", margin + 4, y);
    y += 5;
  } else {
    d.bIndividualScores.forEach(b => {
      ensure(5);
      const roleLabel =
        b.role === "high" ? "DROPPED (high)" :
        b.role === "low"  ? "DROPPED (low)"  :
        b.role === "kept" ? "COUNTED"        : "single";
      const color =
        b.role === "high" || b.role === "low" ? RED :
        b.role === "kept" ? GREEN : GREY;
      pdf.setTextColor(NAVY);
      pdf.text(b.slot, margin + 2, y);
      pdf.text(b.score === null ? "—" : fmt(b.score), margin + 35, y);
      pdf.setTextColor(color);
      pdf.text(roleLabel, margin + 65, y);
      y += 5;
    });
  }
  y += 2;

  // ── GROUP C ──────────────────────────────────────────────
  if (d.matchMode === "optional") {
    section("GROUP C · DIFFICULTY MOVEMENTS", NAVY);
    kv("Group C score", `${fmt(d.groupCScore)} / ${fmt(d.groupCMax)}`, GREEN);

    ensure(6);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(NAVY);
    pdf.text("Code", margin + 2, y);
    pdf.text("Movement", margin + 22, y);
    pdf.text("Connection", margin + 90, y);
    pdf.text("Value", margin + 130, y);
    pdf.text("Result", margin + 150, y);
    y += 3;
    pdf.setDrawColor("#e5e7eb");
    pdf.line(margin, y, pageW - margin, y);
    y += 3;
    pdf.setFont("helvetica", "normal");
    if (d.cMovements.length === 0) {
      pdf.setTextColor(GREY);
      pdf.text("— no movements registered —", margin + 4, y);
      y += 5;
    } else {
      d.cMovements.forEach(m => {
        ensure(5);
        pdf.setTextColor(NAVY);
        pdf.text(m.code, margin + 2, y);
        const labelLines = pdf.splitTextToSize(m.label || "", 65);
        pdf.text(labelLines[0] ?? "", margin + 22, y);
        pdf.text(m.connection || "—", margin + 90, y);
        pdf.text(`+${fmt(m.value)}`, margin + 130, y);
        if (m.successful === true) {
          pdf.setTextColor(GREEN);
          pdf.text("✓", margin + 150, y);
        } else if (m.successful === false) {
          pdf.setTextColor(RED);
          pdf.text("✗", margin + 150, y);
        } else {
          pdf.setTextColor(GREY);
          pdf.text("—", margin + 150, y);
        }
        y += 5;
      });
    }
    y += 2;
  }

  // ── TA Deductions ────────────────────────────────────────
  section("TECHNICAL ASSISTANT · DEDUCTIONS", NAVY);
  kv("Out of Bounds (OOB) events", String(d.taOobCount), NAVY);
  kv("TA time suggestion · info only", fmt(d.taDeduction), RED);
  kv("Chief Judge deduction · HD", `− ${fmt(d.chiefDeduction)}`, RED);
  y += 2;

  // ── Calculation summary ──────────────────────────────────
  section("FINAL CALCULATION", "#111827");
  kv("Group A", fmt(d.groupAScore), NAVY);
  kv("Group B (avg)", fmt(d.groupBAverage), NAVY);
  if (d.matchMode === "optional") kv("Group C", fmt(d.groupCScore), NAVY);
  kv("TA deduction · info only", fmt(0), RED);
  kv("Chief Judge deduction · HD", `− ${fmt(d.chiefDeduction)}`, RED);

  ensure(12);
  pdf.setDrawColor(GOLD);
  pdf.setLineWidth(0.5);
  pdf.line(margin, y, pageW - margin, y);
  y += 6;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(NAVY);
  pdf.text("FINAL SCORE", margin + 2, y);
  pdf.setTextColor(ORANGE);
  pdf.setFontSize(20);
  pdf.text(fmt(d.finalScore), pageW - margin - 2, y, { align: "right" });
  y += 8;

  // ── Signatures ───────────────────────────────────────────
  ensure(28);
  y += 6;
  const colW = (pageW - 2 * margin) / 3;
  ["Chief Referee", "Technical Assistant", "Head of Jury"].forEach((label, i) => {
    const x = margin + i * colW;
    pdf.setDrawColor(NAVY);
    pdf.setLineWidth(0.3);
    pdf.line(x + 4, y + 14, x + colW - 4, y + 14);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(GREY);
    pdf.text(label, x + colW / 2, y + 18, { align: "center" });
  });

  // Footer
  pdf.setFontSize(7);
  pdf.setTextColor("#9ca3af");
  pdf.text(
    "Generated by the Tunisian Wushu Judging Platform — confidential, for official use only.",
    pageW / 2,
    pageH - 6,
    { align: "center" },
  );

  const safeName = (d.athleteName || "athlete").replace(/[^a-z0-9\u0600-\u06FF]+/gi, "_");
  const filename = `ScoreSheet_${safeName}_${new Date(d.committedAt).toISOString().slice(0, 10)}.pdf`;
  const blob = pdf.output("blob");
  return { blob, filename };
}
