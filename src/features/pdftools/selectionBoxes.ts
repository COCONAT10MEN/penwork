import type { PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import type { Mark, MarkKind } from "../../lib/pdftools/markup";

/** Paper colours for the marks, not the app's: they're printed on the page. */
export const MARK_COLORS: Record<MarkKind, string> = {
  highlight: "#ffeb3b",
  underline: "#1e88e5",
  strike: "#e53935",
};

/** One run of selected text on one line: where it is on screen, and its words. */
export interface Piece {
  span: HTMLElement;
  page: HTMLElement;
  rect: DOMRect;
  text: string;
}

/**
 * The selected text, run by run. Measured from the text itself: the range's own boxes also take
 * in pdf.js's invisible end-of-page block, which made the whole page look selected.
 */
export function selectedPieces(doc: Document): Piece[] {
  const sel = doc.getSelection();
  const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
  if (!range || range.collapsed) return [];
  const root = range.commonAncestorContainer;
  const walker = doc.createTreeWalker(
    root.nodeType === 3 ? (root.parentNode ?? root) : root,
    NodeFilter.SHOW_TEXT,
  );
  const out: Piece[] = [];
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    if (!range.intersectsNode(node)) continue;
    const span = node.parentElement;
    const page = span?.closest<HTMLElement>(".page[data-page-number]");
    if (!span || !page || !span.closest(".textLayer")) continue;
    const from = node === range.startContainer ? range.startOffset : 0;
    const to = node === range.endContainer ? range.endOffset : node.data.length;
    const text = node.data.slice(from, to);
    if (!text.trim()) continue;
    const part = doc.createRange();
    part.setStart(node, from);
    part.setEnd(node, to);
    const rect = part.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 2) continue;
    out.push({ span, page, rect, text });
  }
  return out;
}

/** Where the selection is on screen: its first line's top, its last line's bottom, its middle. */
export function selectionBounds(pieces: Piece[]) {
  if (!pieces.length) return null;
  const top = Math.min(...pieces.map((p) => p.rect.top));
  const bottom = Math.max(...pieces.map((p) => p.rect.bottom));
  const left = Math.min(...pieces.map((p) => p.rect.left));
  const right = Math.max(...pieces.map((p) => p.rect.right));
  return { top, bottom, middle: (left + right) / 2 };
}

/** A box on screen, in a page's own coordinates. */
export function pageBox(viewer: PDFViewer, page: HTMLElement, r: DOMRect) {
  const n = Number(page.dataset.pageNumber);
  const view = viewer.getPageView(n - 1)?.viewport;
  if (!view) return null;
  const p = page.getBoundingClientRect();
  const [ax, ay] = view.convertToPdfPoint(r.left - p.left, r.bottom - p.top) as [number, number];
  const [bx, by] = view.convertToPdfPoint(r.right - p.left, r.top - p.top) as [number, number];
  return {
    n,
    scale: view.scale,
    box: [Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)] as [
      number,
      number,
      number,
      number,
    ],
  };
}

/** The selection's lines as boxes in each page's own coordinates, one per line. */
export function selectionMarks(doc: Document, viewer: PDFViewer, kind: MarkKind): Mark[] {
  const byPage = new Map<number, [number, number, number, number][]>();
  for (const piece of selectedPieces(doc)) {
    const at = pageBox(viewer, piece.page, piece.rect);
    if (!at) continue;
    const box = at.box;
    // Runs of one line join into one box.
    const list = byPage.get(at.n) ?? [];
    const same = list.find(
      (b) =>
        Math.min(b[3], box[3]) - Math.max(b[1], box[1]) > 0.5 * (box[3] - box[1]) &&
        box[0] - b[2] < 4 &&
        b[0] - box[2] < 4,
    );
    if (same) {
      same[0] = Math.min(same[0], box[0]);
      same[1] = Math.min(same[1], box[1]);
      same[2] = Math.max(same[2], box[2]);
      same[3] = Math.max(same[3], box[3]);
    } else list.push(box);
    byPage.set(at.n, list);
  }
  return [...byPage].map(([page, boxes]) => ({ page, kind, color: MARK_COLORS[kind], boxes }));
}
