import {
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFRef,
  PDFStream,
  type PDFDocument,
  type PDFPage,
} from "pdf-lib";
import { drawOnTop } from "./content";
import { load, save } from "./pages";

/**
 * Flatten: form fields, notes, stamps and ink become part of the page itself, so they look the same
 * everywhere and can't be changed or removed any more. Each one is drawn from its own picture (its
 * appearance stream), exactly as viewers show it.
 */

const nums = (a: unknown): number[] | null =>
  a instanceof PDFArray
    ? a.asArray().map((v) => (v instanceof PDFNumber ? v.asNumber() : 0))
    : null;

/** Where an appearance's box lands after its own matrix, as [x0, y0, x1, y1]. */
function placedBox(bbox: number[], matrix: number[]): number[] {
  const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = matrix;
  const [x0 = 0, y0 = 0, x1 = 1, y1 = 1] = bbox;
  const pts = [
    [x0, y0],
    [x1, y0],
    [x0, y1],
    [x1, y1],
  ].map(([x = 0, y = 0]) => [a * x + c * y + e, b * x + d * y + f] as const);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

const HIDDEN = 2;
const NO_VIEW = 32;

/** Kinds that only do something in a viewer, with nothing to draw. */
const SKIP = new Set(["/Link", "/Popup"]);

function flattenPage(doc: PDFDocument, page: PDFPage, keepLinks: boolean): number {
  const annots = page.node.Annots();
  if (!annots) return 0;
  const kept: PDFRef[] = [];
  let ops = "";
  let count = 0;
  for (const entry of annots.asArray()) {
    const annot = doc.context.lookup(entry);
    if (!(annot instanceof PDFDict)) continue;
    const subtype = annot.get(PDFName.of("Subtype"))?.toString() ?? "";
    if (SKIP.has(subtype)) {
      if (keepLinks && subtype === "/Link" && entry instanceof PDFRef) kept.push(entry);
      continue;
    }
    const flags = (annot.get(PDFName.of("F")) as PDFNumber | undefined)?.asNumber() ?? 0;
    if (flags & (HIDDEN | NO_VIEW)) continue;
    const rect = nums(annot.get(PDFName.of("Rect")));
    let normal = doc.context.lookup(
      (annot.lookup(PDFName.of("AP")) as PDFDict | undefined)?.get(PDFName.of("N")),
    );
    // A choice of looks (a ticked or unticked box): the one in use.
    if (normal instanceof PDFDict && !(normal instanceof PDFStream)) {
      const state = annot.get(PDFName.of("AS"));
      normal = state instanceof PDFName ? doc.context.lookup(normal.get(state)) : undefined;
    }
    const ref = (() => {
      const ap = annot.lookup(PDFName.of("AP")) as PDFDict | undefined;
      const n = ap?.get(PDFName.of("N"));
      if (n instanceof PDFRef && doc.context.lookup(n) instanceof PDFStream) return n;
      const state = annot.get(PDFName.of("AS"));
      const states = n instanceof PDFRef ? doc.context.lookup(n) : n;
      if (states instanceof PDFDict && state instanceof PDFName) {
        const s = states.get(state);
        if (s instanceof PDFRef) return s;
      }
      return null;
    })();
    if (!rect || !(normal instanceof PDFStream) || !ref) continue;
    const bbox = nums(normal.dict.get(PDFName.of("BBox"))) ?? [0, 0, 1, 1];
    const matrix = nums(normal.dict.get(PDFName.of("Matrix"))) ?? [1, 0, 0, 1, 0, 0];
    const [bx0 = 0, by0 = 0, bx1 = 1, by1 = 1] = placedBox(bbox, matrix);
    const [ax = 0, ay = 0, bx = 0, by = 0] = rect;
    const [rx0, ry0, rx1, ry1] = [
      Math.min(ax, bx),
      Math.min(ay, by),
      Math.max(ax, bx),
      Math.max(ay, by),
    ];
    const sx = bx1 - bx0 ? (rx1 - rx0) / (bx1 - bx0) : 1;
    const sy = by1 - by0 ? (ry1 - ry0) / (by1 - by0) : 1;
    if (!normal.dict.has(PDFName.of("Subtype")))
      normal.dict.set(PDFName.of("Subtype"), PDFName.of("Form"));
    const name = page.node.newXObject("Flat", ref);
    const f = (v: number) => +v.toFixed(4);
    ops += `q ${f(sx)} 0 0 ${f(sy)} ${f(rx0 - bx0 * sx)} ${f(ry0 - by0 * sy)} cm ${name.toString()} Do Q\n`;
    count++;
  }
  if (ops) drawOnTop(doc, page, ops);
  if (kept.length) page.node.set(PDFName.of("Annots"), doc.context.obj(kept));
  else page.node.delete(PDFName.of("Annots"));
  return count;
}

export async function flatten(
  bytes: Uint8Array,
  o: { pages?: number[]; keepLinks?: boolean } = {},
): Promise<{ bytes: Uint8Array; count: number }> {
  const doc = await load(bytes);
  // Form fields first: their pictures are their annotations, drawn below with the rest. The form
  // itself goes, so nothing is left to fill in.
  doc.catalog.delete(PDFName.of("AcroForm"));
  const all = doc.getPages();
  const pages = o.pages ?? all.map((_, i) => i + 1);
  let count = 0;
  for (const n of pages) {
    const page = all[n - 1];
    if (page) count += flattenPage(doc, page, o.keepLinks ?? true);
  }
  return { bytes: await save(doc), count };
}
