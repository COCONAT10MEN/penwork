import { existsSync, readFileSync } from "node:fs";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { removeText } from "./textRemove";

/** The page's text as pdf.js reads it: each piece with where it starts. */
async function textOf(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  const content = await (await doc.getPage(1)).getTextContent();
  return content.items.flatMap((i) =>
    "str" in i && i.str.trim() ? [{ text: i.str, x: (i.transform as number[])[4] ?? 0 }] : [],
  );
}

// Windows' own Arial, when the tests run on Windows; elsewhere that test is skipped.
const ARIAL = "C:/Windows/Fonts/arial.ttf";

describe("taking words out of a page for good", () => {
  it("takes out one word in a built-in font; the words after it stay put", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 200]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText("Hello world again", { x: 40, y: 100, size: 20, font });
    const bytes = await doc.save();
    const helloW = font.widthOfTextAtSize("Hello ", 20);
    const worldW = font.widthOfTextAtSize("world", 20);
    const { bytes: out, removed } = await removeText(bytes, [
      { page: 1, x: 40 + helloW, y: 96, width: worldW, height: 18 },
    ]);
    expect(removed).toEqual([true]);
    const after = await textOf(out);
    const text = after.map((t) => t.text).join(" ");
    expect(text).not.toMatch(/world/);
    expect(text).toMatch(/Hello/);
    expect(text).toMatch(/again/);
    // "again" starts where it did.
    const again = after.find((i) => i.text.includes("again")) as { text: string; x: number };
    const x =
      again.x + font.widthOfTextAtSize(again.text.slice(0, again.text.indexOf("again")), 20);
    expect(Math.abs(x - (40 + font.widthOfTextAtSize("Hello world ", 20)))).toBeLessThan(0.5);
  }, 60_000);

  it.skipIf(!existsSync(ARIAL))(
    "works in an embedded font too (two bytes a letter, widths from the font)",
    async () => {
      const doc = await PDFDocument.create();
      doc.registerFontkit(fontkit);
      const page = doc.addPage([400, 200]);
      const font = await doc.embedFont(readFileSync(ARIAL), { subset: true });
      page.drawText("Keep this remove that", { x: 30, y: 120, size: 16, font });
      const keepW = font.widthOfTextAtSize("Keep this ", 16);
      const removeW = font.widthOfTextAtSize("remove", 16);
      const { bytes: out, removed } = await removeText(await doc.save(), [
        { page: 1, x: 30 + keepW, y: 116, width: removeW, height: 14 },
      ]);
      expect(removed).toEqual([true]);
      const text = (await textOf(out)).map((t) => t.text).join(" ");
      expect(text).not.toMatch(/remove/);
      expect(text).toMatch(/Keep this/);
      expect(text).toMatch(/that/);
    },
    60_000,
  );

  it("leaves a page alone where the area has no words", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 200]);
    page.drawText("Nothing here moves", {
      x: 40,
      y: 100,
      size: 12,
      font: await doc.embedFont(StandardFonts.Helvetica),
    });
    const bytes = await doc.save();
    const r = await removeText(bytes, [{ page: 1, x: 300, y: 20, width: 50, height: 20 }]);
    expect(r.removed).toEqual([false]);
    expect(r.bytes).toBe(bytes);
  });
});
