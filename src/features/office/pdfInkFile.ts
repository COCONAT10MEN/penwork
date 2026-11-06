import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef, PDFString } from "pdf-lib";
import {
  dotPath,
  dotWidth,
  hexToRgb,
  outlinePath,
  roundBoxPath,
  strokeBox,
  strokeOutline,
  type PointStroke,
} from "../../lib/pdfInk";

/** Penwork's own ink annotations carry this key with the stroke, so they can be edited again. */
const KEY = "PWStroke";
const MARK = new TextEncoder().encode(`/${KEY}`);

/** Finding the mark is much quicker than parsing the file, and most PDFs won't have it. */
function hasMark(bytes: Uint8Array): boolean {
  outer: for (let i = 0; i <= bytes.length - MARK.length; i++) {
    for (let j = 0; j < MARK.length; j++) if (bytes[i + j] !== MARK[j]) continue outer;
    return true;
  }
  return false;
}

/**
 * Takes Penwork's ink out of a file: the strokes by page number, and the file without them, which
 * is what pdf.js shows, so the ink isn't drawn twice. Anyone else's annotations stay.
 */
export async function takeInk(
  bytes: Uint8Array,
): Promise<{ clean: Uint8Array; pages: Record<number, PointStroke[]> }> {
  if (!hasMark(bytes)) return { clean: bytes, pages: {} };
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const pages: Record<number, PointStroke[]> = {};
  doc.getPages().forEach((page, index) => {
    const annots = page.node.Annots();
    if (!annots) return;
    const kept = [];
    for (let i = 0; i < annots.size(); i++) {
      const ref = annots.get(i);
      const dict = doc.context.lookup(ref);
      const data = dict instanceof PDFDict ? dict.get(PDFName.of(KEY)) : undefined;
      if (data instanceof PDFString && dict instanceof PDFDict) {
        try {
          (pages[index + 1] ??= []).push(JSON.parse(data.decodeText()) as PointStroke);
          // Gone from the file too, with its drawing, not just unhooked from the page: a left-over
          // object is dead weight, and every save would carry it along.
          const look = dict.lookupMaybe(PDFName.of("AP"), PDFDict)?.get(PDFName.of("N"));
          if (look instanceof PDFRef) doc.context.delete(look);
          if (ref instanceof PDFRef) doc.context.delete(ref);
          continue;
        } catch {
          // Not readable: it stays in the file as it is.
        }
      }
      kept.push(ref);
    }
    page.node.set(PDFName.of("Annots"), doc.context.obj(kept));
  });
  const clean = await doc.save({ useObjectStreams: false, updateFieldAppearances: false });
  return { clean, pages };
}

/**
 * One stroke as a real ink annotation: its ink list for readers that draw ink themselves, and an
 * appearance with the exact outline Penwork draws, so every reader shows the same thing. The
 * highlighter keeps its strength and multiplies, as on screen.
 */
function addStroke(doc: PDFDocument, stroke: PointStroke) {
  const [r, g, b] = hexToRgb(stroke.c);
  const box = strokeBox(stroke.pts, stroke.w);
  const highlight = stroke.k === "h";
  const strength = highlight ? (stroke.op ?? 0.42) : 1;
  const first = stroke.pts[0];
  const last = stroke.pts[stroke.pts.length - 1];
  // Text highlights are a rounded box per line; an area is one rounded box; the rest are outlines.
  const shape = stroke.rects
    ? stroke.rects
        .map(([x0, y0, x1, y1]) => roundBoxPath(x0, y0, x1, y1, Math.min((y1 - y0) * 0.22, 6)))
        .join(" ")
    : stroke.box && first && last
      ? roundBoxPath(first[0], first[1], last[0], last[1], 8)
      : stroke.pts.length === 1 && first
        ? dotPath(first[0], first[1], dotWidth(stroke, first[2]) / 2)
        : outlinePath(strokeOutline(stroke));
  const state = doc.context.obj({
    Type: "ExtGState",
    CA: strength,
    ca: strength,
    BM: highlight ? "Multiply" : "Normal",
  });
  const look = doc.context.stream(
    `/S0 gs ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${shape}`,
    {
      Type: "XObject",
      Subtype: "Form",
      BBox: box,
      Resources: { ExtGState: { S0: state } },
    },
  );
  return doc.context.obj({
    Type: "Annot",
    Subtype: "Ink",
    Rect: box,
    InkList: [stroke.pts.flatMap(([x, y]) => [x, y])],
    C: [r, g, b],
    CA: strength,
    BS: { W: stroke.w, S: "S" },
    F: 4,
    NM: PDFString.of(`penwork-${crypto.randomUUID()}`),
    AP: { N: doc.context.register(look) },
    [KEY]: PDFString.of(JSON.stringify(stroke)),
  });
}

/** Writes each page's ink into the file. Pages without ink are untouched. */
export async function putInk(
  bytes: Uint8Array,
  pages: Record<number, PointStroke[]>,
): Promise<Uint8Array> {
  const filled = Object.entries(pages).filter(([, strokes]) => strokes.length > 0);
  if (filled.length === 0) return bytes;
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const all = doc.getPages();
  for (const [number, strokes] of filled) {
    const page = all[Number(number) - 1];
    if (!page) continue;
    let annots = page.node.Annots();
    if (!annots) {
      annots = doc.context.obj([]) as PDFArray;
      page.node.set(PDFName.of("Annots"), annots);
    }
    for (const stroke of strokes) annots.push(doc.context.register(addStroke(doc, stroke)));
  }
  // Plain objects, so the mark can be found again without parsing the whole file.
  return doc.save({ useObjectStreams: false, updateFieldAppearances: false });
}
