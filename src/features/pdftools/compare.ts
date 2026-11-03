import type { PDFDocumentProxy } from "pdfjs-dist";
import { pageText } from "./pdfRead";

/**
 * Compare: the text of this PDF against another, word by word. Each change says which page it's
 * on here, so the list can take the reader straight to it.
 */

export interface Change {
  kind: "added" | "removed" | "changed";
  /** What this PDF has (removed or changed from the other). */
  here: string;
  /** What the other has instead. */
  there: string;
  page: number;
  otherPage: number;
}

async function allText(doc: PDFDocumentProxy, progress: (n: number) => void) {
  let text = "";
  const starts: number[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    progress(n);
    starts.push(text.length);
    const { lines } = await pageText(doc, n);
    text += lines.map((l) => l.text).join("\n") + "\n";
  }
  return { text, starts };
}

const pageAt = (starts: number[], at: number) => {
  let page = 1;
  for (let i = 0; i < starts.length; i++) if ((starts[i] ?? Infinity) <= at) page = i + 1;
  return page;
};

export async function compare(
  here: PDFDocumentProxy,
  other: PDFDocumentProxy,
  progress: (done: number, total: number) => void,
): Promise<Change[]> {
  const total = here.numPages + other.numPages + 1;
  const a = await allText(here, (n) => progress(n, total));
  const b = await allText(other, (n) => progress(here.numPages + n, total));
  const { diffWordsWithSpace } = await import("diff");
  const parts = diffWordsWithSpace(a.text, b.text);
  progress(total, total);
  const out: Change[] = [];
  let atA = 0;
  let atB = 0;
  for (const part of parts) {
    const value = part.value;
    if (part.removed || part.added) {
      if (value.trim()) {
        const last = out[out.length - 1];
        // A removal straight after an addition, or before one, is one change.
        if (part.added && last?.kind === "removed" && !last.there) {
          last.kind = "changed";
          last.there = value.trim();
        } else
          out.push({
            kind: part.added ? "added" : "removed",
            here: part.removed ? value.trim() : "",
            there: part.added ? value.trim() : "",
            page: pageAt(a.starts, atA),
            otherPage: pageAt(b.starts, atB),
          });
      }
      if (part.removed) atA += value.length;
      else atB += value.length;
    } else {
      atA += value.length;
      atB += value.length;
    }
    if (out.length >= 1000) break;
  }
  return out;
}
