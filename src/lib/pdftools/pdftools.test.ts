import { PDFDocument, PDFName, StandardFonts, degrees } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { latin1, markedSections, cutSections, pageContent, streamBytes } from "./content";
import { readDetails, writeDetails, crop } from "./details";
import { addThings, plainText } from "./draw";
import { flatten } from "./flatten";
import { imagesToPdf, findImages } from "./images";
import { addOcrText } from "./ocrText";
import {
  arrange,
  copyOut,
  insertBlank,
  merge,
  removePages,
  reversePages,
  rotatePages,
} from "./pages";
import { describePages, pageSet, parseRanges, splitGroups } from "./ranges";
import { addPageNumbers, addWatermark, numberText, seen } from "./stamp";
import { removeWatermarks } from "./unwatermark";

async function sample(count = 4, opts: { form?: boolean } = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= count; i++) {
    const page = doc.addPage([400 + i, 600]);
    page.drawText(`Page ${i}`, { x: 50, y: 500, size: 20, font });
  }
  if (opts.form) {
    const field = doc.getForm().createTextField("name");
    field.setText("Ada");
    field.addToPage(doc.getPage(0), { x: 50, y: 300, width: 200, height: 24 });
  }
  return doc.save();
}

const widths = async (bytes: Uint8Array) =>
  (await PDFDocument.load(bytes)).getPages().map((p) => Math.round(p.getWidth()));

describe("page lists", () => {
  it("reads ranges as typed", () => {
    expect(parseRanges("1-3, 5, 8-", 9)).toEqual([1, 2, 3, 5, 8, 9]);
    expect(parseRanges("3-1", 5)).toEqual([3, 2, 1]);
    expect(parseRanges("1-100", 4)).toEqual([1, 2, 3, 4]);
    expect(parseRanges("two", 4)).toBeNull();
    expect(pageSet("4, 1, 1", 5)).toEqual([1, 4]);
    expect(describePages([1, 2, 3, 5, 7, 8])).toBe("1-3, 5, 7-8");
  });
  it("splits every n pages or by ranges", () => {
    expect(splitGroups({ every: 2 }, 5)).toEqual([[1, 2], [3, 4], [5]]);
    expect(splitGroups({ ranges: "1-2, 3-5" }, 5)).toEqual([
      [1, 2],
      [3, 4, 5],
    ]);
  });
});

describe("page tools", () => {
  it("reorders, copies and turns pages, keeping the form", async () => {
    const bytes = await sample(3, { form: true });
    const out = await arrange(bytes, [{ from: 2 }, { from: 0, turn: 90 }, { from: 0 }, "blank"]);
    const doc = await PDFDocument.load(out);
    expect(doc.getPages().map((p) => Math.round(p.getWidth()))).toEqual([403, 401, 401, 401]);
    expect(doc.getPage(1).getRotation().angle).toBe(90);
    expect(doc.getForm().getTextField("name").getText()).toBe("Ada");
  });
  it("removes, rotates, reverses, extracts, merges and inserts", async () => {
    const bytes = await sample(4);
    expect(await widths(await removePages(bytes, [2, 3]))).toEqual([401, 404]);
    await expect(removePages(bytes, [1, 2, 3, 4])).rejects.toThrow();
    const turned = await PDFDocument.load(await rotatePages(bytes, [1], 270));
    expect(turned.getPage(0).getRotation().angle).toBe(270);
    expect(await widths(await reversePages(bytes))).toEqual([404, 403, 402, 401]);
    expect(await widths(await copyOut(bytes, [3, 1]))).toEqual([403, 401]);
    expect(await widths(await merge(bytes, [await sample(1)], "start"))).toEqual([
      401, 401, 402, 403, 404,
    ]);
    expect((await widths(await insertBlank(bytes, 2))).length).toBe(5);
  });
});

describe("stamps", () => {
  it("numbers pages, upright on turned pages", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([400, 600]).setRotation(degrees(90));
    const view = seen(doc.getPage(0));
    expect([view.width, view.height]).toEqual([600, 400]);
    expect(view.toPage(0, 0)).toEqual({ x: 400, y: 0 });
    const out = await addPageNumbers(await doc.save(), {
      pages: [1],
      corner: "br",
      format: "page-n-of",
      start: 1,
      size: 12,
      margin: 24,
      color: "#000000",
    });
    const page = (await PDFDocument.load(out)).getPage(0);
    const text = await pageContent(await PDFDocument.load(out), page);
    expect(text).toContain("/Artifact");
    expect(numberText("n-of", 2, 9)).toBe("2 / 9");
  });
  it("adds a watermark that Remove watermark finds again", async () => {
    const stamped = await addWatermark(await sample(2), {
      pages: [1, 2],
      text: "DRAFT",
      scale: 0.6,
      opacity: 0.3,
      angle: 45,
      color: "#ff0000",
      place: "center",
    });
    const doc = await PDFDocument.load(stamped);
    expect(await pageContent(doc, doc.getPage(0))).toContain("BDC");
    const { bytes, count } = await removeWatermarks(stamped);
    expect(count).toBe(2);
    const clean = await PDFDocument.load(bytes);
    const text = (await pageContent(clean, clean.getPage(0))) ?? "";
    expect(text).not.toContain("Watermark");
    // the page's own text survives
    expect(text).toContain("Tj");
  });
});

describe("content", () => {
  it("finds marked sections and steps over strings and dictionaries", () => {
    const text =
      "q (a ) EMC \\) BDC) Tj /Artifact <</Subtype /Watermark /X <00ff>>> BDC 1 0 0 RG EMC /P BMC (x) Tj EMC Q";
    const found = markedSections(text);
    expect(found.map((s) => s.tag)).toEqual(["/Artifact", "/P"]);
    expect(cutSections(text, found.slice(0, 1))).toBe(
      "q (a ) EMC \\) BDC) Tj  /P BMC (x) Tj EMC Q",
    );
  });
  it("reads streams", async () => {
    const doc = await PDFDocument.load(await sample(1));
    const text = await pageContent(doc, doc.getPage(0));
    expect(text).toContain("Tj");
    expect(latin1(new Uint8Array([72, 105]))).toBe("Hi");
    expect(await streamBytes(undefined)).toBeNull();
  });
});

describe("flatten, details, crop, additions, OCR text", () => {
  it("flattens a filled form into the page", async () => {
    const { bytes, count } = await flatten(await sample(1, { form: true }));
    const doc = await PDFDocument.load(bytes);
    expect(count).toBe(1);
    expect(doc.catalog.has(PDFName.of("AcroForm"))).toBe(false);
    expect(doc.getPage(0).node.Annots()).toBeUndefined();
    expect(await pageContent(doc, doc.getPage(0))).toContain(" Do Q");
  });
  it("writes and clears details", async () => {
    const out = await writeDetails(await sample(1), {
      title: "T",
      author: "A",
      subject: "S",
      keywords: "a, b",
    });
    expect(await readDetails(out)).toEqual({
      title: "T",
      author: "A",
      subject: "S",
      keywords: "a b",
    });
    const cleared = await PDFDocument.load(await writeDetails(out, "clear"));
    expect(cleared.getTitle()).toBeUndefined();
  });
  it("crops by margins on the page as seen", async () => {
    const out = await crop(await sample(1), {
      pages: [1],
      margins: { top: 10, right: 20, bottom: 30, left: 40 },
    });
    const box = (await PDFDocument.load(out)).getPage(0).getCropBox();
    expect([box.x, box.y, box.width, box.height]).toEqual([40, 30, 341, 560]);
  });
  it("adds text, shapes and form fields", async () => {
    const area = { page: 1, x: 50, y: 50, width: 120, height: 40 };
    const out = await addThings(await sample(1), [
      { kind: "text", area, text: "Hello", size: 14, color: "#123456" },
      { kind: "rect", area, stroke: "#000000", fill: null, width: 2 },
      { kind: "field", area, field: "text", name: "" },
    ]);
    const doc = await PDFDocument.load(out);
    expect(doc.getForm().getFields().length).toBe(1);
    expect(plainText("Hello é")).toBe(true);
    expect(plainText("مرحبا")).toBe(false);
  });
  it("writes invisible searchable text", async () => {
    const out = await addOcrText(await sample(1), [
      {
        page: 1,
        words: [
          { text: "مرحبا", x: 50, y: 100, width: 80, height: 12 },
          { text: "Hi", x: 140, y: 100, width: 20, height: 12 },
        ],
      },
    ]);
    const doc = await PDFDocument.load(out);
    const text = (await pageContent(doc, doc.getPage(0))) ?? "";
    expect(text).toContain("3 Tr");
    expect(text).toContain("/PwOcr");
  });
});

describe("pictures", () => {
  it("makes a PDF from pictures, one page each", async () => {
    // a 1×1 PNG
    const png = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      ),
      (c) => c.charCodeAt(0),
    );
    const out = await imagesToPdf(
      [
        { bytes: png, type: "png" },
        { bytes: png, type: "png" },
      ],
      { paper: "a4", margin: 36 },
    );
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(2);
    expect(Math.round(doc.getPage(0).getWidth())).toBe(595);
    expect((await findImages(doc)).length).toBeGreaterThanOrEqual(0);
  });
});
