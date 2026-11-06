import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  layoutPage,
  type PageLayout,
  type Piece,
  type Picture,
} from "../../lib/pdftools/pageLayout";
import { loadPdf } from "../office/pdfLoader";
import { faceFor, parseFontName, type Generic } from "./fontMatch";
import { nameOf, type LoadedFont } from "./runFont";

/**
 * A page read for converting: its text with each piece's own font, size, weight, slant and colour,
 * its pictures cut out where they sit, and the layout put back from them (pageLayout.ts). The page
 * is drawn once, at `scale`; the colours and pictures come from that drawing.
 */
export interface ReadPage {
  layout: PageLayout;
  canvas: HTMLCanvasElement;
  scale: number;
  pictures: Map<number, { bytes: Uint8Array; type: "png" | "jpg" }>;
  /** True when the page has no text at all: a scan, best kept as its picture. */
  scanned: boolean;
}

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  fontName: string;
}

const hex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/**
 * The family to write words in: the installed font's own name, or the PDF's made readable; for a
 * font that isn't named (the PDF built-ins), Arial, Times New Roman or Courier New, which are drawn
 * the same size as Helvetica, Times and Courier.
 */
async function familyOf(name: string | null, generic: Generic, bold: boolean, italic: boolean) {
  const face = await faceFor(name, generic, { bold, italic });
  const first = /^'([^']+)'/.exec(face.css)?.[1];
  if (first) return first;
  const parsed = name ? parseFontName(name).family.replace(/([a-z])([A-Z])/g, "$1 $2") : "";
  return (
    parsed ||
    (generic === "serif" ? "Times New Roman" : generic === "mono" ? "Courier New" : "Arial")
  );
}

/** Where the page's pictures are drawn, from its drawing instructions, in points from the top-left. */
async function picturesOn(
  page: Awaited<ReturnType<PDFDocumentProxy["getPage"]>>,
  view: {
    convertToViewportPoint: (x: number, y: number) => number[];
    width: number;
    height: number;
  },
): Promise<Picture[]> {
  const { pdfjs } = await loadPdf();
  const OPS = pdfjs.OPS;
  const list = await page.getOperatorList();
  type M = [number, number, number, number, number, number];
  const mul = (m: M, n: M): M => [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
  let ctm: M = [1, 0, 0, 1, 0, 0];
  const stack: M[] = [];
  const out: Picture[] = [];
  const images = new Set<number>([
    OPS.paintImageXObject,
    OPS.paintInlineImageXObject,
    OPS.paintImageXObjectRepeat,
  ]);
  for (let i = 0; i < list.fnArray.length; i++) {
    const fn = list.fnArray[i];
    const args = list.argsArray[i] as unknown[];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
    else if (fn === OPS.transform) ctm = mul(ctm, args as unknown as M);
    else if (fn === OPS.paintFormXObjectBegin) {
      stack.push(ctm);
      const m = args[0] as M | null;
      if (m) ctm = mul(ctm, m);
    } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? ctm;
    else if (fn !== undefined && images.has(fn)) {
      // An image fills the unit square, moved by the current transform.
      const corners = [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ].map(([u = 0, v = 0]) =>
        view.convertToViewportPoint(
          ctm[0] * u + ctm[2] * v + ctm[4],
          ctm[1] * u + ctm[3] * v + ctm[5],
        ),
      );
      const xs = corners.map((c) => c[0] ?? 0);
      const ys = corners.map((c) => c[1] ?? 0);
      const x = Math.max(0, Math.min(...xs));
      const y = Math.max(0, Math.min(...ys));
      const width = Math.min(view.width, Math.max(...xs)) - x;
      const height = Math.min(view.height, Math.max(...ys)) - y;
      if (width >= 16 && height >= 16) out.push({ id: out.length, x, y, width, height });
    }
  }
  return out;
}

export async function readPage(doc: PDFDocumentProxy, n: number, scale = 2): Promise<ReadPage> {
  const page = await doc.getPage(n);
  const view = page.getViewport({ scale: 1 });
  const drawn = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(drawn.width));
  canvas.height = Math.max(1, Math.floor(drawn.height));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("No canvas to draw on.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Drawing the page also loads its fonts, which are read below.
  await page.render({ canvasContext: ctx, canvas, viewport: drawn }).promise;
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const at = (x: number, y: number) => {
    const px = Math.max(0, Math.min(canvas.width - 1, Math.round(x * scale)));
    const py = Math.max(0, Math.min(canvas.height - 1, Math.round(y * scale)));
    const i = (py * canvas.width + px) * 4;
    return [pixels[i] ?? 255, pixels[i + 1] ?? 255, pixels[i + 2] ?? 255] as const;
  };
  /** The colour of text in a box: the pixel most unlike the paper around it. */
  const inkIn = (x: number, top: number, width: number, height: number) => {
    const paper = at(x - 1, top - 1);
    let best = 0;
    let ink: readonly [number, number, number] = [0, 0, 0];
    const step = Math.max(0.5, 1 / scale);
    for (let yy = top; yy < top + height; yy += step)
      for (let xx = x; xx < x + width; xx += step) {
        const c = at(xx, yy);
        const d = Math.abs(c[0] - paper[0]) + Math.abs(c[1] - paper[1]) + Math.abs(c[2] - paper[2]);
        if (d > best) {
          best = d;
          ink = c;
        }
      }
    return hex(...ink);
  };

  const content = await page.getTextContent();
  const styles = content.styles as Record<string, { fontFamily?: string }>;
  const pieces: Piece[] = [];
  const families = new Map<string, Promise<string>>();
  for (const raw of content.items) {
    const item = raw as TextItem;
    if (!("str" in item) || !item.str) continue;
    const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = item.transform;
    const size = Math.hypot(c, d) || Math.hypot(a, b);
    const [x = 0, y = 0] = view.convertToViewportPoint(e, f);
    const loaded = page.commonObjs.has(item.fontName)
      ? (page.commonObjs.get(item.fontName) as LoadedFont)
      : null;
    const name = loaded ? nameOf(loaded) : null;
    const fallback = `${styles[item.fontName]?.fontFamily ?? ""} ${loaded?.fallbackName ?? ""}`;
    const generic: Generic = /mono/.test(fallback)
      ? "mono"
      : /serif/.test(fallback) && !/sans-serif/.test(fallback)
        ? "serif"
        : "sans";
    const bold = !!loaded?.bold || !!loaded?.black || /bold|black|heavy|semibold/i.test(name ?? "");
    const italic = !!loaded?.italic || /italic|oblique/i.test(name ?? "");
    const key = `${name}|${generic}|${bold}|${italic}`;
    let family = families.get(key);
    if (!family) {
      family = familyOf(name, generic, bold, italic);
      families.set(key, family);
    }
    pieces.push({
      text: item.str,
      x,
      y,
      width: item.width,
      size,
      font: await family,
      bold,
      italic,
      color: item.str.trim()
        ? inkIn(x, y - size * 0.7, Math.max(1, item.width), size * 0.7)
        : "#000000",
    });
  }

  const hasText = pieces.some((p) => p.text.trim());
  let pictures = await picturesOn(page, view);
  // A picture filling the page behind text is its background (a scan with OCR text, a letterhead).
  if (hasText)
    pictures = pictures.filter((p) => p.width * p.height < view.width * view.height * 0.7);
  const crops = new Map<number, { bytes: Uint8Array; type: "png" | "jpg" }>();
  for (const p of pictures) {
    const w = Math.max(1, Math.round(p.width * scale));
    const h = Math.max(1, Math.round(p.height * scale));
    const cut = document.createElement("canvas");
    cut.width = w;
    cut.height = h;
    cut
      .getContext("2d")
      ?.drawImage(canvas, Math.round(p.x * scale), Math.round(p.y * scale), w, h, 0, 0, w, h);
    // Big pictures as JPEG, to keep the file small; small ones sharp as PNG.
    const type = w * h > 250_000 ? "jpg" : "png";
    const blob = await new Promise<Blob | null>((done) =>
      cut.toBlob(done, type === "png" ? "image/png" : "image/jpeg", 0.9),
    );
    if (blob) crops.set(p.id, { bytes: new Uint8Array(await blob.arrayBuffer()), type });
  }
  page.cleanup();
  return {
    layout: layoutPage(pieces, pictures, { width: view.width, height: view.height }),
    canvas,
    scale,
    pictures: crops,
    scanned: !hasText,
  };
}
