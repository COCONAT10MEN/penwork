import { describe, expect, it } from "vitest";
import {
  cellOf,
  cellValue,
  toLines,
  toMarkdown,
  toParagraphs,
  toTable,
  type Word,
} from "./textLayout";

const w = (text: string, x: number, y: number, size = 11, bold = false): Word => ({
  text,
  x,
  y,
  width: text.length * size * 0.5,
  size,
  bold,
});

describe("text layout", () => {
  it("puts words back into lines, paragraphs and headings", () => {
    const lines = toLines([
      w("Title", 50, 40, 24, true),
      w("world", 90, 100),
      w("Hello", 50, 100.5),
      w("again and", 50, 114),
      w("• one", 50, 150),
      w("2. two", 50, 166),
    ]);
    expect(lines.map((l) => l.text)).toEqual([
      "Title",
      "Hello world",
      "again and",
      "• one",
      "2. two",
    ]);
    const paras = toParagraphs(lines);
    expect(paras.map((p) => [p.heading, p.list, p.text])).toEqual([
      [1, null, "Title"],
      [0, null, "Hello world again and"],
      [0, "bullet", "one"],
      [0, "number", "two"],
    ]);
    expect(toMarkdown(paras)).toBe("# Title\n\nHello world again and\n\n- one\n\n1. two");
  });
  it("finds table columns", () => {
    const lines = toLines([
      w("Name", 50, 50),
      w("Price", 200, 50),
      w("Tea", 50, 64),
      w("1,200", 200, 64),
    ]);
    expect(toTable(lines)).toEqual([
      ["Name", "Price"],
      ["Tea", "1,200"],
    ]);
    expect(cellValue("1,200")).toBe(1200);
    expect(cellValue("Tea")).toBe("Tea");
  });
});

describe("spreadsheet cells that keep their look", () => {
  it("percentages, separators and money become numbers with a format", () => {
    expect(cellOf("14%")).toEqual({ value: 0.14, format: "0%" });
    expect(cellOf("12.5%")).toEqual({ value: 0.125, format: "0.0%" });
    expect(cellOf("1,250,000")).toEqual({ value: 1250000, format: "#,##0" });
    expect(cellOf("$1,200.50")).toEqual({ value: 1200.5, format: '"$"#,##0.00' });
    expect(cellOf("42")).toEqual({ value: 42 });
    expect(cellOf("North")).toEqual({ value: "North" });
  });
});
