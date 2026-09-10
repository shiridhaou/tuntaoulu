import { describe, expect, test } from "bun:test";
import { normalizeRow } from "./importParsing";

describe("optional difficulty imports", () => {
  test("combines P-series codes with explicit values and connections", () => {
    const row = normalizeRow({
      name: "Athlete One",
      style: "Optional Changquan",
      P1_code: "324C",
      P1_value: "0.4",
      P2_code: "+",
      P2_value: "0.15",
      P3_code: "353B",
    }, "tournament");

    expect(row._mode).toBe("optional");
    expect(row.difficulty_codes).toEqual(["324C", "+", "353B"]);
    expect(row.difficulty_sheet.map(({ code, value }) => ({ code, value }))).toEqual([
      { code: "324C", value: 0.4 },
      { code: "+", value: 0.15 },
      { code: "353B", value: 0.4 },
    ]);
  });

  test("parses sequence text and infers Seniors as optional", () => {
    const row = normalizeRow({
      name: "Athlete Two",
      age_category: "Seniors",
      sequence_text: "324C 6 353B + 323B",
    }, "tournament");

    expect(row._mode).toBe("optional");
    expect(row.difficulty_codes).toEqual(["324C", "6", "353B", "+323B"]);
    expect(row.difficulty_sheet).toHaveLength(5);
  });

  test("keeps an explicit compulsory mode authoritative", () => {
    const row = normalizeRow({
      name: "Athlete Three",
      mode: "Compulsory",
      P1_code: "324C",
    }, "tournament");

    expect(row._mode).toBe("compulsory");
  });
});