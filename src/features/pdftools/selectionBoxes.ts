import type { PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import type { Mark, MarkKind } from "../../lib/pdftools/markup";

/** Paper colours for the marks, not the app's: they're printed on the page. */
export const MARK_COLORS: Record<MarkKind, string> = {
  highlight: "#ffeb3b",
  underline: "#1e88e5",
  strike: "#e53935",
};

/** The selection's lines as boxes in each page's own coordinates, one per line. */
export function selectionMarks(doc: Document, viewer: PDFViewer, kind: MarkKind): Mark[] {
  const range = doc.getSelection()?.rangeCount ? doc.getSelection()?.getRangeAt(0) : null;
  if (!range || range.collapsed) return [];
  const pages = [...doc.querySelectorAll<HTMLElement>(".page[data-page-number]")].map((el) => ({
    n: Number(el.dataset.pageNumber),
    rect: el.getBoundingClientRect(),
  }));
  const byPage = new Map<number, [number, number, number, number][]>();
  for (const r of range.getClientRects()) {
    if (r.width < 1 || r.height < 2) continue;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const page = pages.find(
      (p) => cx >= p.rect.left && cx <= p.rect.right && cy >= p.rect.top && cy <= p.rect.bottom,
    );
    const view = page && viewer.getPageView(page.n - 1)?.viewport;
    if (!page || !view) continue;
    const [ax, ay] = view.convertToPdfPoint(r.left - page.rect.left, r.bottom - page.rect.top) as [
      number,
      number,
    ];
    const [bx, by] = view.convertToPdfPoint(r.right - page.rect.left, r.top - page.rect.top) as [
      number,
      number,
    ];
    const box: [number, number, number, number] = [
      Math.min(ax, bx),
      Math.min(ay, by),
      Math.max(ax, bx),
      Math.max(ay, by),
    ];
    // Pieces of one line join into one box.
    const list = byPage.get(page.n) ?? [];
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
    byPage.set(page.n, list);
  }
  return [...byPage].map(([page, boxes]) => ({ page, kind, color: MARK_COLORS[kind], boxes }));
}
