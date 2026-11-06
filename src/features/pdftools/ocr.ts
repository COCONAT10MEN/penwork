import type { PDFDocumentProxy } from "pdfjs-dist";
import type { OcrWord } from "../../lib/pdftools/ocrText";
import { pageWords, renderPage } from "./pdfRead";

/**
 * OCR with Tesseract, all on this computer: its engine and the English and Arabic data ship with
 * the app (scripts/copy-pdfjs.mjs). Each page is drawn at 300 per inch, read, and its words given
 * back in the page's own coordinates.
 */

export type OcrLanguage = "eng" | "ara";

type Bbox = { x0: number; y0: number; x1: number; y1: number };
type TessWord = { text: string; bbox: Bbox; confidence: number };
type TessBlock = { paragraphs: { lines: { words: TessWord[] }[] }[] };

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
      const words: OcrWord[] = [];
      for (const block of (data.blocks ?? []) as TessBlock[])
        for (const para of block.paragraphs)
          for (const line of para.lines)
            for (const w of line.words) {
              if (!w.text.trim() || w.confidence < 20) continue;
              // The word's bottom-left and its size, from the picture to the page.
              const [x0, y0] = view.convertToPdfPoint(w.bbox.x0, w.bbox.y1);
              const width = (w.bbox.x1 - w.bbox.x0) / scale;
              const height = (w.bbox.y1 - w.bbox.y0) / scale;
              words.push({ text: w.text, x: x0, y: y0 + height * 0.15, width, height });
            }
      out.push({ page: n, words, turn: page.rotate });
      pic.canvas.width = 0;
    }
  } finally {
    await worker.terminate();
  }
  progress(pages.length, pages.length);
  return out;
}

async function startOcr(languages: OcrLanguage[]) {
  const { createWorker, OEM } = await import("tesseract.js");
  return createWorker(languages, OEM.LSTM_ONLY, {
    workerPath: "/ocr/worker.min.js",
    corePath: "/ocr/tesseract-core-simd-lstm.wasm.js",
    langPath: "/ocr/lang",
    cacheMethod: "none",
    gzip: true,
  });
}

/** The text of these pages as Tesseract reads it, line by line, for Extract text. */
export async function readText(
  doc: PDFDocumentProxy,
  pages: number[],
  languages: OcrLanguage[],
  progress: (done: number, total: number) => void,
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (!pages.length) return out;
  const worker = await startOcr(languages);
  try {
    for (let i = 0; i < pages.length; i++) {
      progress(i, pages.length);
      const n = pages[i] ?? 1;
      const base = (await doc.getPage(n)).getViewport({ scale: 1 });
      const pic = await renderPage(
        doc,
        n,
        Math.min(300 / 72, 5000 / Math.max(base.width, base.height)),
        "png",
      );
      const { data } = await worker.recognize(pic.canvas);
      out.set(n, data.text.trim());
      pic.canvas.width = 0;
    }
  } finally {
    await worker.terminate();
  }
  return out;
}
