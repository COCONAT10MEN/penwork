import { describe, expect, it } from "vitest";
import { asPrinted, asShown, DARK_PAGE } from "./pageColors";
import { applyStyle, NO_EDITS, type Picked } from "./pageEdits";

const run = (x0: number, x1: number, text = "words"): Picked => ({
  page: 1,
  box: [x0, 100, x1, 112],
  text,
  font: "sans",
  paper: "#ffffff",
  ink: "#000000",
});

describe("text styles", () => {
  it("toggles a style on and off, like a formatting bar", () => {
    const on = applyStyle(NO_EDITS, [run(10, 60)], "bold");
    expect(on.on).toBe(true);
    expect(on.edits.words).toHaveLength(1);
    expect(on.edits.words[0]?.bold).toBe(true);
    const off = applyStyle(on.edits, [run(10, 60)], "bold");
    expect(off.on).toBe(false);
    expect(off.edits.words).toHaveLength(0);
  });

  it("adds styles together on the same words instead of piling them up", () => {
    const bold = applyStyle(NO_EDITS, [run(10, 60)], "bold").edits;
    const both = applyStyle(bold, [run(10, 60)], "italic").edits;
    expect(both.words).toHaveLength(1);
    expect(both.words[0]).toMatchObject({ bold: true, italic: true, mono: false });
  });

  it("keeps the look of a longer styled run for a part of it", () => {
    const bold = applyStyle(NO_EDITS, [run(10, 200)], "bold").edits;
    const part = applyStyle(bold, [run(50, 90, "or")], "mono").edits;
    expect(part.words.at(-1)).toMatchObject({ bold: true, mono: true });
    // Taking bold off a part draws that part plain over the bold run.
    const plain = applyStyle(bold, [run(50, 90, "or")], "bold").edits;
    expect(plain.words).toHaveLength(2);
    expect(plain.words.at(-1)).toMatchObject({ bold: false, italic: false, mono: false });
  });

  it("underlines, and takes the underline off when pressed again", () => {
    const under = applyStyle(NO_EDITS, [run(10, 60), run(70, 120)], "underline");
    expect(under.on).toBe(true);
    expect(under.edits.lines).toHaveLength(2);
    const again = applyStyle(under.edits, [run(10, 60)], "underline");
    expect(again.on).toBe(false);
    expect(again.edits.lines).toHaveLength(1);
    // A strike through is its own line.
    expect(applyStyle(again.edits, [run(70, 120)], "strike").edits.lines).toHaveLength(2);
  });

  it("turns dark-page colours back into the file's own", () => {
    expect(asShown("#ffffff", true)).toBe(DARK_PAGE.background);
    expect(asShown("#000000", true)).toBe(DARK_PAGE.foreground);
    expect(asPrinted(DARK_PAGE.background, true)).toBe("#ffffff");
    expect(asPrinted(DARK_PAGE.foreground, true)).toBe("#000000");
    expect(asPrinted("#123456", false)).toBe("#123456");
  });
});
