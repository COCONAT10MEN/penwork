import { degrees, PDFDocument, type PDFPage } from "pdf-lib";

/**
 * Page tools. They change the page list of the document itself rather than copying pages into a
 * new one, so what belongs to the whole file stays: its form, outline, details and ink.
 */

export async function load(bytes: Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(bytes, { updateMetadata: false });
}

export async function save(doc: PDFDocument): Promise<Uint8Array> {
  return doc.save({ useObjectStreams: true, updateFieldAppearances: false });
}

/** One entry per page of the result, by its index now; a repeat becomes a copy. */
export interface PageOrder {
  from: number;
  /** Added to the page's own rotation. */
  turn?: number;
}

export async function arrange(
  bytes: Uint8Array,
  order: (PageOrder | "blank")[],
): Promise<Uint8Array> {
  const doc = await load(bytes);
  const pages = doc.getPages();
  const used = new Set<number>();
  const size = pages[0] ? pages[0].getSize() : { width: 595.28, height: 841.89 };
  const result: PDFPage[] = [];
  for (const entry of order) {
    if (entry === "blank") {
      result.push(doc.addPage([size.width, size.height]));
      continue;
    }
    let page = pages[entry.from];
    if (!page) continue;
    if (used.has(entry.from)) [page] = await doc.copyPages(doc, [entry.from]);
    if (!page) continue;
    used.add(entry.from);
    if (entry.turn) page.setRotation(degrees((page.getRotation().angle + entry.turn + 360) % 360));
    result.push(page);
  }
  // Empty the page list, then put back what's wanted in order.
  for (let i = doc.getPageCount() - 1; i >= 0; i--) doc.removePage(i);
  for (const page of result) doc.addPage(page);
  return save(doc);
}

/** Pages counted from 1. */
export async function keepPages(bytes: Uint8Array, pages: number[]): Promise<Uint8Array> {
  return arrange(
    bytes,
    pages.map((n) => ({ from: n - 1 })),
  );
}

export async function removePages(bytes: Uint8Array, pages: number[]): Promise<Uint8Array> {
  const doc = await load(bytes);
  const gone = new Set(pages);
  for (let i = doc.getPageCount(); i >= 1; i--) if (gone.has(i)) doc.removePage(i - 1);
  if (doc.getPageCount() === 0) throw new Error("A PDF needs at least one page.");
  return save(doc);
}

export async function rotatePages(
  bytes: Uint8Array,
  pages: number[],
  turn: number,
): Promise<Uint8Array> {
  const doc = await load(bytes);
  const all = doc.getPages();
  for (const n of pages) {
    const page = all[n - 1];
    if (page) page.setRotation(degrees((page.getRotation().angle + turn + 360) % 360));
  }
  return save(doc);
}

export async function reversePages(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await load(bytes);
  const count = doc.getPageCount();
  return arrange(
    bytes,
    Array.from({ length: count }, (_, i) => ({ from: count - 1 - i })),
  );
}

/** A copy of just these pages, as its own file: what Extract and Split make. */
export async function copyOut(bytes: Uint8Array, pages: number[]): Promise<Uint8Array> {
  const source = await load(bytes);
  const out = await PDFDocument.create({ updateMetadata: false });
  const copies = await out.copyPages(
    source,
    pages.map((n) => n - 1),
  );
  for (const page of copies) out.addPage(page);
  const title = source.getTitle();
  if (title) out.setTitle(title);
  return save(out);
}

/** Other PDFs added after this one's pages, or before them. */
export async function merge(
  bytes: Uint8Array,
  others: Uint8Array[],
  where: "end" | "start" = "end",
): Promise<Uint8Array> {
  const doc = await load(bytes);
  let at = where === "start" ? 0 : doc.getPageCount();
  for (const other of others) {
    const source = await load(other);
    const copies = await doc.copyPages(source, source.getPageIndices());
    for (const page of copies) doc.insertPage(at++, page);
  }
  return save(doc);
}

/** A blank page the size of its neighbour, after page `after` (0 puts it first). */
export async function insertBlank(
  bytes: Uint8Array,
  after: number,
  count = 1,
): Promise<Uint8Array> {
  const doc = await load(bytes);
  const pages = doc.getPages();
  const like = pages[Math.max(0, Math.min(after, pages.length) - 1)] ?? pages[0];
  const { width, height } = like ? like.getSize() : { width: 595.28, height: 841.89 };
  for (let i = 0; i < count; i++)
    doc.insertPage(Math.min(after, pages.length) + i, [width, height]);
  return save(doc);
}
