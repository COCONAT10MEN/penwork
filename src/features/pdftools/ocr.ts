import type { PDFDocumentProxy } from "pdfjs-dist";
import type { OcrWord } from "../../lib/pdftools/ocrText";
import { toLines } from "../../lib/pdftools/textLayout";
import { pageWords, renderPage } from "./pdfRead";

/**
 * OCR with Tesseract, all on this computer: its engine and the English and Arabic data ship with
 * the app (scripts/copy-pdfjs.mjs). Each page is drawn at 300 per inch, read, and its words given
 * back in the page's own coordinates.
 */

export type OcrLanguage = "eng" | "ara";

type Bbox = { x0: number; y0: number; x1: number; y1: number };
type TessWord = { text: string; bbox: Bbox; confidence: number };
type TessLine = {
  words: TessWord[];
  bbox: Bbox;
  baseline: Bbox;
  rowAttributes?: { rowHeight: number; descenders: number };
};
type TessBlock = { paragraphs: { lines: TessLine[] }[] };

/** A word that's only marks with no letters or digits, read with little confidence: noise. */
const noise = (w: TessWord) => w.confidence < 45 && !/[\p{L}\p{N}]/u.test(w.text);

/** Pages that already have text don't need reading, unless asked to. */
export async function pagesWithoutText(doc: PDFDocumentProxy): Promise<number[]> {
  const out: number[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const words = await pageWords(await doc.getPage(n));
    if (words.filter((w) => w.text.trim()).length < 3) out.push(n);
  }
  return out;
}

export async function recognize(
  doc: PDFDocumentProxy,
  pages: number[],
  languages: OcrLanguage[],
  progress: (done: number, total: number) => void,
): Promise<{ page: number; words: OcrWord[]; turn: number }[]> {
  const worker = await startOcr(languages);
  const out: { page: number; words: OcrWord[]; turn: number }[] = [];
  try {
    for (let i = 0; i < pages.length; i++) {
      progress(i, pages.length);
      const n = pages[i] ?? 1;
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      // 300 per inch, but never a picture past 5000 across.
      const scale = Math.min(300 / 72, 5000 / Math.max(base.width, base.height));
      const pic = await renderPage(doc, n, scale, "png");
      const view = page.getViewport({ scale });
      const { data } = await worker.recognize(pic.canvas, {}, { blocks: true });
      const found: { top: number; left: number; word: OcrWord }[] = [];
      for (const block of (data.blocks ?? []) as TessBlock[])
        for (const para of block.paragraphs)
          for (const line of para.lines) {
            // Every word of a line on the line's own baseline, at the line's size: words with
            // and without descenders then read as one line again, not two.
            const b = line.baseline;
            const along = (x: number) =>
              b.x1 === b.x0 ? b.y0 : b.y0 + ((x - b.x0) * (b.y1 - b.y0)) / (b.x1 - b.x0);
            const lineHeight = line.bbox.y1 - line.bbox.y0;
            const descent = line.rowAttributes?.descenders ?? lineHeight * 0.2;
            const size = Math.max(4, (lineHeight - Math.abs(descent)) / scale);
            for (const w of line.words) {
              if (!w.text.trim() || w.confidence < 20 || noise(w)) continue;
              const baseY = Number.isFinite(b.y0) ? along(w.bbox.x0) : w.bbox.y1;
              const [x0, y0] = view.convertToPdfPoint(w.bbox.x0, baseY);
              found.push({
                top: line.bbox.y0,
                left: w.bbox.x0,
                word: {
                  text: w.text,
                  x: x0,
                  y: y0,
                  width: (w.bbox.x1 - w.bbox.x0) / scale,
                  height: size,
                },
              });
            }
          }
      // Line by line, left to right, so selecting and copying read in order.
      found.sort((a, b) => a.top - b.top || a.left - b.left);
      out.push({ page: n, words: found.map((f) => f.word), turn: page.rotate });
      pic.canvas.width = 0;
    }
  } finally {
    await worker.terminate();
  }
  progress(pages.length, pages.length);
  return out;
}

async function startOcr(languages: OcrLanguage[]) {
  const { createWorker, OEM, PSM } = await import("tesseract.js");
  const worker = await createWorker(languages, OEM.LSTM_ONLY, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr/tesseract-core-simd-lstm.wasm.js",
    langPath: "/ocr/lang",
    cacheMethod: "none",
    gzip: true,
  });
  // Every piece of text wherever it is, tables included: page layout mode takes a ruled table for a
  // picture and skips it. Each word is placed by its own box, so the layout isn't needed.
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
  return worker;
}

/** The text of these pages as Tesseract reads it, in lines, for Extract text. */
export async function readText(
  doc: PDFDocumentProxy,
  pages: number[],
  languages: OcrLanguage[],
  progress: (done: number, total: number) => void,
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (!pages.length) return out;
  for (const { page, words } of await recognize(doc, pages, languages, progress)) {
    const height = (await doc.getPage(page)).getViewport({ scale: 1 }).height;
    // Words from the page's own coordinates (y up) to from the top, then into lines.
    const lines = toLines(
      words.map((w) => ({
        text: w.text,
        x: w.x,
        y: height - w.y,
        width: w.width,
        size: w.height,
        bold: false,
      })),
    );
    out.set(page, lines.map((l) => l.text).join("\n"));
  }
  return out;
}
