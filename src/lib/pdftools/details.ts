import { PDFName } from "pdf-lib";
import { load, save } from "./pages";

/** The file's details (title, author…) and its crop. */

export interface Details {
  title: string;
  author: string;
  subject: string;
  keywords: string;
}

export async function readDetails(bytes: Uint8Array): Promise<Details> {
  const doc = await load(bytes);
  return {
    title: doc.getTitle() ?? "",
    author: doc.getAuthor() ?? "",
    subject: doc.getSubject() ?? "",
    keywords: doc.getKeywords() ?? "",
  };
}

/** `clear` removes every detail and the hidden XMP copy, for sharing a file without them. */
export async function writeDetails(bytes: Uint8Array, d: Details | "clear"): Promise<Uint8Array> {
  const doc = await load(bytes);
  if (d === "clear") {
    doc.catalog.delete(PDFName.of("Metadata"));
    for (const set of [
      doc.setTitle,
      doc.setAuthor,
      doc.setSubject,
      doc.setCreator,
      doc.setProducer,
    ])
      set.call(doc, "");
    doc.setKeywords([]);
    const info = doc.context.trailerInfo.Info;
    if (info) doc.context.delete(info as never);
    doc.context.trailerInfo.Info = undefined;
    return doc.save({ useObjectStreams: true, updateFieldAppearances: false });
  }
  doc.setTitle(d.title);
  doc.setAuthor(d.author);
  doc.setSubject(d.subject);
  doc.setKeywords(
    d.keywords
      .split(/[,;]+/)
      .map((k) => k.trim())
      .filter(Boolean),
  );
  // The XMP copy would otherwise still show the old ones in some viewers.
  doc.catalog.delete(PDFName.of("Metadata"));
  return save(doc);
}

export interface CropOptions {
  pages: number[];
  /** Points, on the page as seen. */
  margins?: { top: number; right: number; bottom: number; left: number };
  /** Or an area in the page's own coordinates, from a drag on one page. */
  area?: { x: number; y: number; width: number; height: number };
}

export async function crop(bytes: Uint8Array, o: CropOptions): Promise<Uint8Array> {
  const doc = await load(bytes);
  const all = doc.getPages();
  for (const n of o.pages) {
    const page = all[n - 1];
    if (!page) continue;
    if (o.area) {
      page.setCropBox(o.area.x, o.area.y, o.area.width, o.area.height);
      continue;
    }
    const m = o.margins;
    if (!m) continue;
    const box = page.getCropBox();
    const turn = ((page.getRotation().angle % 360) + 360) % 360;
    // The page's own sides, from the sides as seen.
    const [l, b, r, t] =
      turn === 90
        ? [m.bottom, m.left, m.top, m.right]
        : turn === 180
          ? [m.right, m.top, m.left, m.bottom]
          : turn === 270
            ? [m.top, m.right, m.bottom, m.left]
            : [m.left, m.bottom, m.right, m.top];
    const width = box.width - l - r;
    const height = box.height - b - t;
    if (width < 36 || height < 36)
      throw new Error("Those margins leave almost nothing of the page.");
    page.setCropBox(box.x + l, box.y + b, width, height);
  }
  return save(doc);
}
