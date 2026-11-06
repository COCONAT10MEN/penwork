import { PDFDocument, PDFName } from "pdf-lib";
import { describe, expect, it } from "vitest";
import type { PointStroke } from "../../lib/pdfInk";
import { save } from "../../lib/pdftools/pages";
import { putInk, takeInk } from "./pdfInkFile";

async function blank(pages = 2): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) doc.addPage([612, 792]);
  return doc.save();
}

const pen: PointStroke = {
  k: "p",
  c: "#e5352b",
  w: 3,
  pts: [
    [100, 700, 0.5],
    [150, 650, 0.6],
    [200, 640, 0.4],
  ],
};
const marker: PointStroke = { ...pen, k: "h", c: "#ffd400", w: 14, op: 0.42 };

describe("ink in a PDF file", () => {
  it("leaves a file without ink exactly as it was", async () => {
    const bytes = await blank();
    expect(await putInk(bytes, {})).toBe(bytes);
    const { clean, pages } = await takeInk(bytes);
    expect(clean).toBe(bytes);
    expect(pages).toEqual({});
  });

  it("writes real ink annotations that read back the same", async () => {
    const saved = await putInk(await blank(), { 2: [pen, marker] });
    const doc = await PDFDocument.load(saved);
    const annots = doc.getPage(1).node.Annots();
    expect(annots?.size()).toBe(2);
    const first = doc.context.lookup(annots?.get(0));
    expect(
      String((first as unknown as { get: (n: PDFName) => unknown }).get(PDFName.of("Subtype"))),
    ).toBe("/Ink");
    const { pages } = await takeInk(saved);
    expect(pages).toEqual({ 2: [pen, marker] });
  });

  it("takes Penwork's ink out of what is shown, and keeps everyone else's", async () => {
    const withOther = await PDFDocument.load(await blank(1));
    const page = withOther.getPage(0);
    const other = withOther.context.obj({ Type: "Annot", Subtype: "Text", Rect: [0, 0, 10, 10] });
    page.node.set(PDFName.of("Annots"), withOther.context.obj([withOther.context.register(other)]));
    const saved = await putInk(await withOther.save(), { 1: [pen] });
    const { clean, pages } = await takeInk(saved);
    expect(pages[1]).toEqual([pen]);
    const shown = await PDFDocument.load(clean);
    expect(shown.getPage(0).node.Annots()?.size()).toBe(1);
  });

  it("leaves nothing of the old ink behind in the clean copy", async () => {
    const saved = await putInk(await blank(1), { 1: [pen, marker] });
    const text = new TextDecoder("latin1").decode((await takeInk(saved)).clean);
    expect(text).not.toMatch(/\/Subtype\s*\/Ink/);
    expect(text).not.toContain("PWStroke");
  });

  it("never writes ink twice when saved again from the clean copy", async () => {
    const once = await putInk(await blank(1), { 1: [pen] });
    const { clean, pages } = await takeInk(once);
    const twice = await putInk(clean, pages);
    expect((await takeInk(twice)).pages[1]).toHaveLength(1);
  });
});

describe("area and text highlights", () => {
  it("save as rounded boxes that read back as the same highlight", async () => {
    const { PDFDocument: Doc } = await import("pdf-lib");
    const base = await Doc.create();
    base.addPage([400, 600]);
    const saved = await putInk(await base.save(), {
      1: [
        {
          k: "h",
          c: "#ffeb3b",
          w: 4,
          op: 0.4,
          box: 1,
          pts: [
            [50, 100, 0.5],
            [200, 160, 0.5],
          ],
        },
        {
          k: "h",
          c: "#ffeb3b",
          w: 4,
          op: 0.4,
          rects: [
            [50, 300, 250, 316],
            [50, 280, 180, 296],
          ],
          pts: [
            [50, 280, 0.5],
            [250, 316, 0.5],
          ],
        },
      ],
    });
    const back = await takeInk(saved);
    expect(back.pages[1]?.[0]?.box).toBe(1);
    expect(back.pages[1]?.[1]?.rects).toEqual([
      [50, 300, 250, 316],
      [50, 280, 180, 296],
    ]);
  });

  it("finds the ink in a file a tool saved with compressed object streams", async () => {
    const inked = await PDFDocument.load(await putInk(await blank(), { 1: [pen] }));
    const packed = await save(inked);
    expect((await takeInk(packed)).pages).toEqual({});
    expect((await takeInk(packed, true)).pages[1]).toHaveLength(1);
  });
});
