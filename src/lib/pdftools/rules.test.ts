import { PDFDocument, rgb } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { Piece, TableBlock } from "./pageLayout";
import { layoutPage } from "./pageLayout";
import { ruledTables } from "./ruledTables";
import { gridsOf, rulesOf, type Grid, type Rule } from "./rules";

/** A grid of lines: columns at xs, rows at ys. */
function grid(xs: number[], ys: number[]): Rule[] {
  const top = ys[0] as number;
  const bottom = ys[ys.length - 1] as number;
  const left = xs[0] as number;
  const right = xs[xs.length - 1] as number;
  return [
    ...xs.map((x) => ({
      across: false,
      at: x,
      from: top,
      to: bottom,
      thickness: 0.5,
      color: "#000000",
    })),
    ...ys.map((y) => ({
      across: true,
      at: y,
      from: left,
      to: right,
      thickness: 0.5,
      color: "#000000",
    })),
  ];
}

const piece = (text: string, x: number, y: number, size = 10): Piece => ({
  text,
  x,
  y,
  width: text.length * size * 0.5,
  size,
  font: "Arial",
  bold: false,
  italic: false,
  color: "#000000",
});

describe("tables drawn with lines", () => {
  it("reads lines and filled boxes from a PDF's drawing", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 200]);
    // A line across as a thin filled box, a line down stroked, and a shaded box.
    page.drawRectangle({ x: 20, y: 150, width: 200, height: 0.5, color: rgb(0, 0, 0) });
    page.drawLine({ start: { x: 50, y: 40 }, end: { x: 50, y: 160 }, thickness: 1 });
    page.drawRectangle({ x: 100, y: 60, width: 80, height: 30, color: rgb(0.8, 0.8, 0.8) });
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const p = await (await pdfjs.getDocument({ data: await doc.save() }).promise).getPage(1);
    const view = p.getViewport({ scale: 1 });
    const ops = await p.getOperatorList();
    const { rules, fills } = rulesOf(
      ops.fnArray,
      ops.argsArray,
      pdfjs.OPS as unknown as Record<string, number>,
      (x, y) => view.convertToViewportPoint(x, y),
    );
    const across = rules.find((r) => r.across);
    const down = rules.find((r) => !r.across);
    expect(across?.at).toBeCloseTo(200 - 150.25, 1);
    expect(across?.from).toBeCloseTo(20, 1);
    expect(down?.at).toBeCloseTo(50, 1);
    expect(fills).toHaveLength(1);
    expect(fills[0]?.color).toBe("#cccccc");
  }, 60_000);

  it("finds a grid, and not a box round a note", () => {
    expect(gridsOf(grid([10, 60, 110], [10, 30, 50]))[0]).toMatchObject({
      xs: [10, 60, 110],
      ys: [10, 30, 50],
    });
    expect(gridsOf(grid([10, 110], [10, 50]))).toEqual([]);
  });

  it("puts each word in its cell, however tight the columns", () => {
    // Two columns 30 points wide, numbers set right against the line between them.
    const g = gridsOf(grid([10, 40, 70], [10, 25, 40]))[0] as Grid;
    const pieces = [
      piece("Qty", 12, 21),
      piece("Price", 42, 21),
      piece("120", 23, 36),
      piece("4.50", 50, 36),
      piece("Outside", 10, 80),
    ];
    const { tables, rest } = ruledTables(pieces, [g], []);
    expect(rest.map((p) => p.text)).toEqual(["Outside"]);
    const t = tables[0] as TableBlock;
    expect(t.rows.map((r) => r.map((c) => c.map((x) => x.text).join("")))).toEqual([
      ["Qty", "Price"],
      ["120", "4.50"],
    ]);
    expect(t.ruled?.align[1]).toEqual(["right", "right"]);
  });

  it("takes a grid with almost nothing written in it as a drawing", () => {
    const g = gridsOf(grid([10, 30, 50, 70, 90], [10, 30, 50, 70]))[0] as Grid;
    const { tables, rest } = ruledTables([piece("0", 12, 26)], [g], []);
    expect(tables).toEqual([]);
    expect(rest).toHaveLength(1);
  });

  it("lays a ruled table out among the page's paragraphs", () => {
    const rules = grid([72, 200, 300], [100, 120, 140]);
    const layout = layoutPage(
      [
        piece("Before the table.", 72, 80),
        piece("A", 75, 115),
        piece("B", 205, 115),
        piece("C", 75, 135),
        piece("D", 205, 135),
        piece("After it.", 72, 170),
      ],
      [],
      { width: 400, height: 300 },
      { grids: gridsOf(rules), fills: [] },
    );
    expect(layout.blocks.map((b) => b.kind)).toEqual(["paragraph", "table", "paragraph"]);
  });
});
