import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef } from "pdf-lib";
import { streamBytes } from "./content";
import { load, save } from "./pages";

/** Pictures in and out of PDFs, and making the pictures inside smaller. */

export interface ImagePage {
  bytes: Uint8Array;
  type: "png" | "jpg";
}

const SIZES = { a4: [595.28, 841.89], letter: [612, 792] } as const;

/** One page per picture: sized to the picture, or a paper size turned to suit it, with a margin. */
export async function imagesToPdf(
  images: ImagePage[],
  o: { paper: "fit" | "a4" | "letter"; margin: number },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const img of images) {
    const image =
      img.type === "png" ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);
    // Pictures come in at 96 per inch, as on screen.
    const w = (image.width * 72) / 96;
    const h = (image.height * 72) / 96;
    if (o.paper === "fit") {
      const page = doc.addPage([w + o.margin * 2, h + o.margin * 2]);
      page.drawImage(image, { x: o.margin, y: o.margin, width: w, height: h });
      continue;
    }
    const [pw, ph] = SIZES[o.paper];
    const [width, height] = w > h ? [ph, pw] : [pw, ph];
    const room = { w: width - o.margin * 2, h: height - o.margin * 2 };
    const scale = Math.min(room.w / w, room.h / h, 1);
    const page = doc.addPage([width, height]);
    page.drawImage(image, {
      x: (width - w * scale) / 2,
      y: (height - h * scale) / 2,
      width: w * scale,
      height: h * scale,
    });
  }
  return save(doc);
}

const name = (d: PDFDict, key: string) => d.get(PDFName.of(key))?.toString() ?? "";
const num = (d: PDFDict, key: string) =>
  (d.get(PDFName.of(key)) as PDFNumber | undefined)?.asNumber() ?? 0;

/** What an image's pixels are, if they're plain enough to read here. */
export function imageKind(doc: PDFDocument, d: PDFDict): "jpg" | "rgb" | "gray" | null {
  const filter = d.get(PDFName.of("Filter"));
  const filters =
    filter instanceof PDFArray ? filter.asArray().map(String) : filter ? [String(filter)] : [];
  if (d.has(PDFName.of("Decode")) || d.has(PDFName.of("ImageMask"))) return null;
  let cs = d.get(PDFName.of("ColorSpace"));
  if (cs instanceof PDFRef) cs = doc.context.lookup(cs);
  let channels = 0;
  if (String(cs) === "/DeviceRGB") channels = 3;
  else if (String(cs) === "/DeviceGray") channels = 1;
  else if (cs instanceof PDFArray && String(cs.get(0)) === "/ICCBased") {
    const icc = doc.context.lookup(cs.get(1));
    const n = icc instanceof PDFRawStream ? num(icc.dict, "N") : 0;
    if (n === 1 || n === 3) channels = n;
  }
  if (!channels) return null;
  if (filters.length === 1 && filters[0] === "/DCTDecode") return "jpg";
  if (num(d, "BitsPerComponent") !== 8 || d.has(PDFName.of("DecodeParms"))) return null;
  if (filters.length === 1 && filters[0] === "/FlateDecode") return channels === 3 ? "rgb" : "gray";
  return null;
}

export interface FoundImage {
  ref: PDFRef;
  kind: "jpg" | "rgb" | "gray";
  width: number;
  height: number;
  /** A JPEG as it is in the file, or the raw pixels. */
  data: Uint8Array;
}

export async function findImages(doc: PDFDocument): Promise<FoundImage[]> {
  const out: FoundImage[] = [];
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream) || name(obj.dict, "Subtype") !== "/Image") continue;
    const kind = imageKind(doc, obj.dict);
    if (!kind) continue;
    const data = kind === "jpg" ? obj.contents : await streamBytes(obj);
    if (!data) continue;
    out.push({ ref, kind, width: num(obj.dict, "Width"), height: num(obj.dict, "Height"), data });
  }
  return out;
}

/** Turns pixels into a picture file; given by the caller, which has a canvas to do it with. */
export type Encoder = (
  img: FoundImage,
  o: { maxSide: number; quality: number; type: "jpg" | "png" },
) => Promise<Uint8Array | null>;

export const COMPRESS = {
  light: { maxSide: 3000, quality: 0.85 },
  recommended: { maxSide: 2000, quality: 0.72 },
  strong: { maxSide: 1300, quality: 0.55 },
} as const;

/**
 * Makes each picture smaller and keeps it only where that saved space. Photos become JPEGs; a
 * picture with flat colours (a diagram, a screenshot) is left alone at the lighter levels, where
 * JPEG would blur its edges.
 */
export async function compressImages(
  bytes: Uint8Array,
  level: keyof typeof COMPRESS,
  encode: Encoder,
  progress?: (done: number, total: number) => void,
): Promise<{ bytes: Uint8Array; images: number }> {
  const doc = await load(bytes);
  const found = await findImages(doc);
  const { maxSide, quality } = COMPRESS[level];
  let changed = 0;
  for (let i = 0; i < found.length; i++) {
    progress?.(i, found.length);
    const img = found[i];
    if (!img) continue;

    const old = doc.context.lookup(img.ref);
    if (!(old instanceof PDFRawStream)) continue;
    const big = Math.max(img.width, img.height) > maxSide;
    if (img.kind !== "jpg" && level !== "strong" && old.contents.length < 200_000) continue;
    if (img.kind === "jpg" && !big && level === "light") continue;
    const jpg = await encode(img, { maxSide, quality, type: "jpg" }).catch(() => null);
    if (!jpg || jpg.length >= old.contents.length * 0.9) continue;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const dict = doc.context.obj({
      Type: "XObject",
      Subtype: "Image",
      Width: Math.round(img.width * scale),
      Height: Math.round(img.height * scale),
      ColorSpace: "DeviceRGB",
      BitsPerComponent: 8,
      Filter: "DCTDecode",
      Length: jpg.length,
    });
    for (const key of ["SMask", "Interpolate", "Intent", "OC", "Metadata"]) {
      const v = old.dict.get(PDFName.of(key));
      if (v) dict.set(PDFName.of(key), v);
    }
    doc.context.assign(img.ref, PDFRawStream.of(dict, jpg));
    changed++;
  }
  progress?.(found.length, found.length);
  return { bytes: await save(doc), images: changed };
}
