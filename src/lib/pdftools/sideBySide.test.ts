import { describe, expect, it } from "vitest";
import type { Block, ParagraphBlock } from "./pageLayout";
import { sideBySide } from "./sideBySide";

/** A one-line paragraph from x0 to x1, its line's top at y. */
const line = (x0: number, x1: number, y: number): ParagraphBlock => ({
  kind: "paragraph",
  top: y,
  bottom: y + 12,
  left: x0,
  right: x1,
  align: "left",
  firstLine: 0,
  spaceBefore: 0,
  lineHeight: null,
  heading: 0,
  list: null,
  size: 10,
  runs: [],
  lines: [],
});

describe("lines side by side", () => {
  it("sets an invoice's sender beside its number, and goes on below", () => {
    const blocks: Block[] = [
      line(72, 180, 100), // sender
      line(450, 540, 104), // INVOICE
      line(72, 160, 118), // street
      line(460, 540, 124), // number
      line(72, 170, 136), // town
      line(72, 300, 190), // "Bill to", well below: not part of it
    ];
    const out = sideBySide(blocks);
    expect(out.map((b) => b.kind)).toEqual(["sideBySide", "paragraph"]);
    const pair = out[0] as Extract<(typeof out)[number], { kind: "sideBySide" }>;
    expect(pair.left).toHaveLength(3);
    expect(pair.right).toHaveLength(2);
  });

  it("leaves a date on the right, below the address, as it is", () => {
    const blocks: Block[] = [line(72, 200, 100), line(450, 540, 140), line(72, 180, 170)];
    expect(sideBySide(blocks).map((b) => b.kind)).toEqual(["paragraph", "paragraph", "paragraph"]);
  });
});
