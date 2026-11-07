import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  layoutPage,
  type PageLayout,
  type Piece,
  type Picture,
} from "../../lib/pdftools/pageLayout";
import { glyphsOf, looksLetterSpaced, respace, splitAtGaps } from "../../lib/pdftools/spacedText";
import { loadPdf } from "../office/pdfLoader";
import { faceFor, type Generic } from "./fontMatch";
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
  /**
   * With `background` asked for: the page drawn without its text (art, boxes, diagrams, pictures,
   * and text that's part of the art: sideways labels, lettering filled with a picture), and whether
   * the page is designed (much drawn besides text and pictures), so better kept looking as it is.
   */
  background?: HTMLCanvasElement;
  designed?: boolean;
}

type Matrix = [number, number, number, number, number, number];
type OpList = Awaited<
  ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["getOperatorList"]>
>;
const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const turned = (m: Matrix) =>
  Math.abs(m[1]) + Math.abs(m[2]) > 0.02 * (Math.abs(m[0]) + Math.abs(m[3]));

/**
 * For pdf.js's render: leaves out the drawing of plain text (filled or outlined, upright), so the
 * page comes out with everything else. Sideways text and text used as a clip (lettering filled with
 * a picture or a gradient) stay: they're part of the art. Worked out as the drawing goes.
 */
function withoutText(OPS: Record<string, number>) {
  const show = new Set([
    OPS.showText,
    OPS.showSpacedText,
    OPS.nextLineShowText,
    OPS.nextLineSetSpacingShowText,
  ]);
  let scanned = 0;
  const drop: boolean[] = [];
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  let tm: Matrix = [1, 0, 0, 1, 0, 0];
  let mode = 0;
  const stack: { ctm: Matrix; mode: number }[] = [];
  return (i: number, list: { fnArray: number[]; argsArray: unknown[] }) => {
    for (; scanned <= i && scanned < list.fnArray.length; scanned++) {
      const fn = list.fnArray[scanned];
      const args = (list.argsArray[scanned] ?? []) as unknown[];
      if (fn === OPS.save) stack.push({ ctm, mode });
      else if (fn === OPS.restore) {
        const back = stack.pop();
        if (back) ({ ctm, mode } = back);
      } else if (fn === OPS.transform) ctm = multiply(ctm, args as unknown as Matrix);
      else if (fn === OPS.paintFormXObjectBegin) {
        stack.push({ ctm, mode });
        const m = args[0] as Matrix | null;
        if (m) ctm = multiply(ctm, m);
      } else if (fn === OPS.paintFormXObjectEnd) {
        const back = stack.pop();
        if (back) ({ ctm, mode } = back);
      } else if (fn === OPS.beginText) tm = [1, 0, 0, 1, 0, 0];
      else if (fn === OPS.setTextMatrix)
        tm = Array.from(
          (Array.isArray(args[0]) || ArrayBuffer.isView(args[0])
            ? args[0]
            : args) as ArrayLike<number>,
        ) as Matrix;
      else if (fn === OPS.setTextRenderingMode) mode = Number(args[0] ?? 0);
      drop[scanned] = fn !== undefined && show.has(fn) && mode <= 2 && !turned(multiply(ctm, tm));
    }
    return !drop[i];
  };
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
 * The family to write words in: the installed font's own name (or its twin's, fontMatch.ts); for a
 * font that isn't on this PC, Arial, Times New Roman or Courier New by its kind. Naming a missing
 * font would leave Word to choose, and it sets everything in one serif face.
 */
async function familyOf(name: string | null, generic: Generic, bold: boolean, italic: boolean) {
  const face = await faceFor(name, generic, { bold, italic });
  const first = /^'([^']+)'/.exec(face.css)?.[1];
  if (first) return first;
  return generic === "serif" ? "Times New Roman" : generic === "mono" ? "Courier New" : "Arial";
}

/** Where the page's pictures are drawn, from its drawing instructions, in points from the top-left. */
async function picturesOn(
  list: OpList,
  view: {
    convertToViewportPoint: (x: number, y: number) => number[];
    width: number;
    height: number;
  },
): Promise<Picture[]> {
  const { pdfjs } = await loadPdf();
  const OPS = pdfjs.OPS;
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

export async function readPage(
  doc: PDFDocumentProxy,
  n: number,
  scale = 2,
  o: { background?: boolean } = {},
): Promise<ReadPage> {
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
  // The page again without its text, when asked: what the text sits on.
  let background: HTMLCanvasElement | undefined;
  let under: Uint8ClampedArray | undefined;
  if (o.background) {
    const { pdfjs } = await loadPdf();
    background = document.createElement("canvas");
    background.width = canvas.width;
    background.height = canvas.height;
    const bctx = background.getContext("2d", { willReadFrequently: true });
    if (bctx) {
      bctx.fillStyle = "#fff";
      bctx.fillRect(0, 0, background.width, background.height);
      await page.render({
        canvasContext: bctx,
        canvas: background,
        viewport: drawn,
        operationsFilter: withoutText(pdfjs.OPS as unknown as Record<string, number>),
      }).promise;
      under = bctx.getImageData(0, 0, background.width, background.height).data;
    }
  }
  const index = (x: number, y: number) => {
    const px = Math.max(0, Math.min(canvas.width - 1, Math.round(x * scale)));
    const py = Math.max(0, Math.min(canvas.height - 1, Math.round(y * scale)));
    return (py * canvas.width + px) * 4;
  };
  const at = (x: number, y: number) => {
    const i = index(x, y);
    return [pixels[i] ?? 255, pixels[i + 1] ?? 255, pixels[i + 2] ?? 255] as const;
  };
  /**
   * The colour of text in a box: the pixel most unlike what's under it (the page without its text,
   * when there is one; else the paper just outside the box), and how unlike it is: next to nothing
   * means the text isn't drawn there at all (invisible text, or text that's part of the art).
   */
  const inkIn = (x: number, top: number, width: number, height: number) => {
    const paper = at(x - 1, top - 1);
    let best = 0;
    let ink: readonly [number, number, number] = [0, 0, 0];
    const step = Math.max(0.5, 1 / scale);
    for (let yy = top; yy < top + height; yy += step)
      for (let xx = x; xx < x + width; xx += step) {
        const i = index(xx, yy);
        const c = [pixels[i] ?? 255, pixels[i + 1] ?? 255, pixels[i + 2] ?? 255] as const;
        const b = under ? [under[i] ?? 255, under[i + 1] ?? 255, under[i + 2] ?? 255] : paper;
        const d =
          Math.abs(c[0] - (b[0] ?? 0)) +
          Math.abs(c[1] - (b[1] ?? 0)) +
          Math.abs(c[2] - (b[2] ?? 0));
        if (d > best) {
          best = d;
          ink = c;
        }
      }
    return { color: hex(...ink), shown: best };
  };

  const content = await page.getTextContent();
  const styles = content.styles as Record<string, { fontFamily?: string }>;
  const pieces: Piece[] = [];
  const families = new Map<string, Promise<string>>();
  for (const raw of content.items) {
    const item = raw as TextItem;
    if (!("str" in item) || !item.str) continue;
    const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = item.transform;
    // Sideways text stays part of the picture of the page; it can't sit on a line of text.
    if (Math.abs(b) + Math.abs(c) > 0.02 * (Math.abs(a) + Math.abs(d))) continue;
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
    const ink = item.str.trim()
      ? inkIn(x, y - size * 0.7, Math.max(1, item.width), size * 0.7)
      : { color: "#000000", shown: 255 };
    // Text that leaves no mark on the page as drawn: invisible (OCR under a scan), or drawn as
    // part of the art. With a background it's in the picture already, so it isn't written again.
    if (under && ink.shown < 60) continue;
    pieces.push({
      text: item.str,
      x,
      y,
      width: item.width,
      size,
      font: await family,
      bold,
      italic,
      color: ink.color,
    });
  }

  // The same words drawn again in nearly the same place are one: a web page's text shadow or glow
  // is the text drawn under itself. The last drawn is the one on top, the one that's seen.
  for (let i = pieces.length - 1; i >= 0; i--) {
    const p = pieces[i] as Piece;
    const copy = pieces.findIndex(
      (q, j) =>
        j < i &&
        q.text === p.text &&
        Math.abs(q.x - p.x) < p.size * 0.5 &&
        Math.abs(q.y - p.y) < p.size * 0.5,
    );
    if (copy >= 0) pieces.splice(copy, 1);
  }
  const hasText = pieces.some((p) => p.text.trim());
  const list = await page.getOperatorList();
  // Where each letter is drawn: letter-spaced words get their spaces back, and pieces with
  // something drawn inside them (a root sign) are cut there, so the Word page puts each part back.
  if (pieces.length) {
    const { pdfjs } = await loadPdf();
    const glyphs = glyphsOf(
      list.fnArray,
      list.argsArray,
      pdfjs.OPS as unknown as Record<string, number>,
      (x, y) => view.convertToViewportPoint(x, y),
    );
    for (const p of pieces) {
      if (looksLetterSpaced(p.text)) p.text = respace(p, glyphs) ?? p.text;
      const parts = splitAtGaps(p, glyphs);
      if (parts) p.parts = parts;
    }
  }
  let pictures = await picturesOn(list, view);
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
  // Designed: much drawn besides the text and the pictures (boxes, fills, art, diagrams).
  let designed = false;
  if (under) {
    let marked = 0;
    let seen = 0;
    const inPicture = (x: number, y: number) =>
      pictures.some((p) => x >= p.x && x <= p.x + p.width && y >= p.y && y <= p.y + p.height);
    for (let y = 0; y < view.height; y += 3)
      for (let x = 0; x < view.width; x += 3) {
        seen++;
        if (inPicture(x, y)) continue;
        const i = index(x, y);
        if (765 - (under[i] ?? 255) - (under[i + 1] ?? 255) - (under[i + 2] ?? 255) > 40) marked++;
      }
    designed = marked / Math.max(1, seen) > 0.04;
  }
  page.cleanup();
  return {
    layout: layoutPage(pieces, pictures, { width: view.width, height: view.height }),
    canvas,
    scale,
    pictures: crops,
    scanned: !hasText,
    ...(background ? { background, designed } : {}),
  };
}
