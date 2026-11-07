import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { glyphsOf, looksLetterSpaced, respace, splitAtGaps, type Glyph } from "./spacedText";

/** Letters 6 points wide, 2 apart, and 6 apart where a word ends. */
function spaced(words: string[], y = 100) {
  const glyphs: Glyph[] = [];
  let x = 50;
  for (const w of words) {
    for (const ch of w) {
      glyphs.push({ ch, x, y, right: x + 6, space: false });
      x += 8;
    }
    x += 4;
  }
  return { glyphs, width: x - 50 };
}

describe("letter-spaced words read back as words", () => {
  it("knows letter-spaced text from words with spaces", () => {
    expect(looksLetterSpaced("P H Y S I C S")).toBe(true);
    expect(looksLetterSpaced("τ = BIAN sin θ")).toBe(false);
    expect(looksLetterSpaced("Chapter 2 • Lesson 5")).toBe(false);
  });

  it("puts spaces only at the word gaps", () => {
    const { glyphs, width } = spaced(["PHYSICS", "•", "3RD", "SECONDARY"]);
    const text = "P H Y S I C S • 3 R D S E C O N D A R Y";
    expect(respace({ text, x: 50, y: 100, width, size: 10 }, glyphs)).toBe(
      "PHYSICS • 3RD SECONDARY",
    );
  });

  it("takes a shadow's letters once", () => {
    const { glyphs, width } = spaced(["BOOK"]);
    const shadow = glyphs.map((g) => ({ ...g, x: g.x + 0.5, right: g.right + 0.5, y: 100.7 }));
    expect(
      respace({ text: "B O O K", x: 50, y: 100, width, size: 10 }, [...glyphs, ...shadow]),
    ).toBe("BOOK");
  });

  it("leaves words already a space apart, and letters that don't match, alone", () => {
    const { glyphs, width } = spaced(["a", "b", "c", "d"]);
    const wide = glyphs.map((g, i) => ({ ...g, x: 50 + i * 9, right: 50 + i * 9 + 5 }));
    expect(respace({ text: "a b c d", x: 50, y: 100, width, size: 10 }, wide)).toBeNull();
    expect(respace({ text: "w x y z", x: 50, y: 100, width, size: 10 }, glyphs)).toBeNull();
  });

  it("cuts a piece where something is drawn inside it, and only there", () => {
    // "1 : √2 : 0", the root sign a shape: 12 points between ":" and "2", 3 between the rest.
    const glyphs: Glyph[] = [];
    let x = 10;
    for (const [ch, gap] of [["1", 3], [":", 12], ["2", 3], [":", 3], ["0", 0]] as const) {
      glyphs.push({ ch, x, y: 50, right: x + 5, space: false });
      x += 5 + gap;
    }
    const piece = { text: "1 : 2 : 0", x: 10, y: 50, width: x - 10, size: 10 };
    const parts = splitAtGaps(piece, glyphs);
    expect(parts?.map((p) => p.text)).toEqual(["1 :", " 2 : 0"]);
    expect(parts?.map((p) => p.text).join("")).toBe(piece.text);
    expect(parts?.[1]?.x).toBe(10 + 8 + 17);
    // Evenly spaced words aren't cut.
    const even = glyphs.map((g, i) => ({ ...g, x: 10 + i * 8, right: 15 + i * 8 }));
    expect(splitAtGaps({ ...piece, width: 40 }, even)).toBeNull();
  });

  it("finds where a PDF draws each letter", async () => {
    // Each letter drawn on its own, as Chrome writes letter-spaced text.
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 200]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    let x = 20;
    for (const w of ["TWO", "WORDS"]) {
      for (const ch of w) {
        page.drawText(ch, { x, y: 120, size: 10, font });
        x += font.widthOfTextAtSize(ch, 10) + 2;
      }
      x += 5;
    }
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdf = await pdfjs.getDocument({ data: await doc.save() }).promise;
    const p = await pdf.getPage(1);
    const view = p.getViewport({ scale: 1 });
    const ops = await p.getOperatorList();
    const glyphs = glyphsOf(
      ops.fnArray,
      ops.argsArray,
      pdfjs.OPS as unknown as Record<string, number>,
      (gx, gy) => view.convertToViewportPoint(gx, gy),
    );
    expect(glyphs.map((g) => g.ch).join("")).toBe("TWOWORDS");
    expect(glyphs[0]?.x).toBeCloseTo(20, 1);
    expect(glyphs[0]?.y).toBeCloseTo(80, 1);
    expect(
      respace({ text: "T W O W O R D S", x: 20, y: 80, width: x - 20, size: 10 }, glyphs),
    ).toBe("TWO WORDS");
  }, 60_000);
});
