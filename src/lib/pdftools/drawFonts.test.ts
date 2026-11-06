import { existsSync, readFileSync } from "node:fs";
import { PDFDocument, PDFName } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { addThings } from "./draw";

// Windows' own Arial, when the tests run on Windows; elsewhere this is skipped.
const ARIAL = "C:/Windows/Fonts/arial.ttf";

describe.skipIf(!existsSync(ARIAL))("text in an installed font", () => {
  it("puts the font in the file, with only the letters used", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([400, 300]);
    const out = await addThings(
      await doc.save(),
      [
        {
          kind: "text",
          area: { page: 1, x: 40, y: 100, width: 200, height: 20 },
          text: "Edited words",
          size: 14,
          color: "#000000",
          face: { css: "Arial", installed: "Arial (TrueType)" },
          baseline: 104,
          track: { text: "Old words", width: 70 },
        },
      ],
      { "Arial (TrueType)": new Uint8Array(readFileSync(ARIAL)) },
    );
    const back = await PDFDocument.load(out);
    const fonts = back.getPage(0).node.Resources()?.lookup(PDFName.of("Font"));
    const names = JSON.stringify(fonts?.toString());
    // Arial itself, embedded (pdf-lib names its subset ArialMT-and-a-number).
    expect(names).toMatch(/ArialMT/);
    expect(out.length).toBeLessThan(200_000);
  });

  it("falls back to the built-in font when the installed one isn't given", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([400, 300]);
    const out = await addThings(await doc.save(), [
      {
        kind: "text",
        area: { page: 1, x: 40, y: 100, width: 200, height: 20 },
        text: "Words",
        size: 14,
        color: "#000000",
        face: { css: "Arial", installed: "Arial (TrueType)" },
      },
    ]);
    const back = await PDFDocument.load(out);
    expect(JSON.stringify(back.getPage(0).node.Resources()?.toString())).toMatch(/Helvetica/);
  });
});
