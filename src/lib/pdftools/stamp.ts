import {
  degrees,
  PDFName,
  PDFOperator,
  PDFOperatorNames,
  rgb,
  StandardFonts,
  type PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { fromLatin1 } from "./content";
import { load, save } from "./pages";

/**
 * Things stamped on pages: page numbers and watermarks. Positions are worked out on the page as it
 * is seen (after its rotation and crop), so a number at "bottom right" is there however the page
 * is turned. Each stamp is marked as an artifact, so Remove watermark can find Penwork's own.
 */

export type Corner = "tl" | "tc" | "tr" | "bl" | "bc" | "br";

/** The page as seen: its size, and a way from a point on it to the page's own coordinates. */
export function seen(page: PDFPage) {
  const box = page.getCropBox();
  const turn = ((page.getRotation().angle % 360) + 360) % 360;
  const sideways = turn === 90 || turn === 270;
  const width = sideways ? box.height : box.width;
  const height = sideways ? box.width : box.height;
  const toPage = (u: number, v: number) => {
    const [x, y] =
      turn === 90
        ? [box.width - v, u]
        : turn === 180
          ? [box.width - u, box.height - v]
          : turn === 270
            ? [v, box.height - u]
            : [u, v];
    return { x: box.x + x, y: box.y + y };
  };
  return { width, height, turn, toPage };
}

export function hexColor(hex: string) {
  const n = parseInt(hex.replace("#", "").padEnd(6, "0").slice(0, 6), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Wraps what the page draws already, so its leftover drawing state can't move the stamp. */
export function isolate(doc: PDFDocument, page: PDFPage): void {
  const start = doc.context.register(doc.context.flateStream(fromLatin1("q\n")));
  const end = doc.context.register(doc.context.flateStream(fromLatin1("\nQ\n")));
  if (!page.node.wrapContentStreams(start, end)) return;
}

function marked(
  doc: PDFDocument,
  page: PDFPage,
  kind: "Watermark" | "PageNumber",
  draw: () => void,
) {
  page.pushOperators(
    PDFOperator.of(PDFOperatorNames.BeginMarkedContentSequence, [
      PDFName.of("Artifact"),
      // An inline property list; pdf-lib writes it as written, though its types expect a name.
      doc.context.obj({
        Type: "Pagination",
        Subtype: kind === "Watermark" ? "Watermark" : "Footer",
      }) as unknown as PDFName,
    ]),
  );
  draw();
  page.pushOperators(PDFOperator.of(PDFOperatorNames.EndMarkedContent));
}

/** Text upright on the page as seen, its baseline starting at (u, v), turned by `angle`. */
function seenText(
  page: PDFPage,
  text: string,
  u: number,
  v: number,
  o: { font: PDFFont; size: number; color: string; opacity: number; angle?: number },
) {
  const view = seen(page);
  const at = view.toPage(u, v);
  page.drawText(text, {
    x: at.x,
    y: at.y,
    size: o.size,
    font: o.font,
    color: hexColor(o.color),
    opacity: o.opacity,
    rotate: degrees((o.angle ?? 0) + view.turn),
  });
}

export interface NumberOptions {
  pages: number[];
  corner: Corner;
  format: "n" | "page-n" | "n-of" | "page-n-of";
  start: number;
  size: number;
  margin: number;
  color: string;
}

export function numberText(format: NumberOptions["format"], n: number, total: number): string {
  return format === "n"
    ? `${n}`
    : format === "page-n"
      ? `Page ${n}`
      : format === "n-of"
        ? `${n} / ${total}`
        : `Page ${n} of ${total}`;
}

/** Where a page number's baseline starts, on the page as seen, for text this wide. */
export function numberSpot(
  view: { width: number; height: number },
  o: Pick<NumberOptions, "corner" | "margin" | "size">,
  textWidth: number,
) {
  const u =
    o.corner[1] === "l"
      ? o.margin
      : o.corner[1] === "r"
        ? view.width - o.margin - textWidth
        : (view.width - textWidth) / 2;
  const v = o.corner[0] === "b" ? o.margin : view.height - o.margin - o.size * 0.72;
  return { u, v };
}

export async function addPageNumbers(bytes: Uint8Array, o: NumberOptions): Promise<Uint8Array> {
  const doc = await load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const all = doc.getPages();
  const total = o.start + o.pages.length - 1;
  o.pages.forEach((n, i) => {
    const page = all[n - 1];
    if (!page) return;
    const text = numberText(o.format, o.start + i, total);
    const { u, v } = numberSpot(seen(page), o, font.widthOfTextAtSize(text, o.size));
    isolate(doc, page);
    marked(doc, page, "PageNumber", () =>
      seenText(page, text, u, v, { font, size: o.size, color: o.color, opacity: 1 }),
    );
  });
  return save(doc);
}

export interface WatermarkOptions {
  pages: number[];
  text?: string;
  image?: { bytes: Uint8Array; type: "png" | "jpg" };
  /** Of the page's width, for an image; the text is sized to match. */
  scale: number;
  opacity: number;
  angle: number;
  color: string;
  place: "center" | Corner;
}

/**
 * A watermark's size and place on the page as seen: its width and height before it's turned, the
 * text size, and where its bottom-left corner ends up once it's turned around its middle. Measured
 * by the text's width at size 1 in its font, or by a picture's width over its height.
 */
export function watermarkSpot(
  view: { width: number; height: number },
  o: Pick<WatermarkOptions, "scale" | "angle" | "place">,
  measure: { widthAt1?: number; aspect?: number },
) {
  const a = (o.angle * Math.PI) / 180;
  let w: number;
  let h: number;
  let size = 0;
  if (measure.aspect) {
    w = view.width * o.scale;
    h = w / measure.aspect;
  } else {
    size = Math.max(6, (view.width * o.scale) / Math.max(1, measure.widthAt1 ?? 1));
    w = (measure.widthAt1 ?? 0) * size;
    h = size * 0.72;
  }
  const pad = 36;
  const cx =
    o.place === "center"
      ? view.width / 2
      : o.place[1] === "l"
        ? pad + w / 2
        : o.place[1] === "r"
          ? view.width - pad - w / 2
          : view.width / 2;
  const cy =
    o.place === "center"
      ? view.height / 2
      : o.place[0] === "b"
        ? pad + h / 2
        : view.height - pad - h / 2;
  const u = cx - Math.cos(a) * (w / 2) + Math.sin(a) * (h / 2);
  const v = cy - Math.sin(a) * (w / 2) - Math.cos(a) * (h / 2);
  return { w, h, size, u, v };
}

export async function addWatermark(bytes: Uint8Array, o: WatermarkOptions): Promise<Uint8Array> {
  const doc = await load(bytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  let image: PDFImage | null = null;
  if (o.image)
    image =
      o.image.type === "png"
        ? await doc.embedPng(o.image.bytes)
        : await doc.embedJpg(o.image.bytes);
  const all = doc.getPages();
  for (const n of o.pages) {
    const page = all[n - 1];
    if (!page) continue;
    const view = seen(page);
    const { w, h, size, u, v } = watermarkSpot(
      view,
      o,
      image
        ? { aspect: image.width / image.height }
        : { widthAt1: font.widthOfTextAtSize(o.text ?? "", 1) },
    );
    isolate(doc, page);
    marked(doc, page, "Watermark", () => {
      if (image) {
        const at = view.toPage(u, v);
        page.drawImage(image, {
          x: at.x,
          y: at.y,
          width: w,
          height: h,
          opacity: o.opacity,
          rotate: degrees(o.angle + view.turn),
        });
      } else {
        seenText(page, o.text ?? "", u, v, {
          font,
          size,
          color: o.color,
          opacity: o.opacity,
          angle: o.angle,
        });
      }
    });
  }
  return save(doc);
}
