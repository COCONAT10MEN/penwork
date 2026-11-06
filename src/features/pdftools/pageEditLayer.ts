import { StandardFontEmbedder, StandardFonts } from "pdf-lib";
import type { PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import type { Addition } from "../../lib/pdftools/draw";
import { arrowHeads, SHAPES } from "../../lib/pdftools/shapes";
import { numberSpot, numberText, watermarkSpot } from "../../lib/pdftools/stamp";
import { asShown } from "./pageColors";
import { NO_EDITS, wordThings, type PageEdits, type Stamp } from "./pageEdits";
import { MARK_COLORS } from "./selectionBoxes";

const SVG = "http://www.w3.org/2000/svg";
const GENERIC_CSS = {
  sans: "Arial, Helvetica, sans-serif",
  serif: "'Times New Roman', Times, serif",
  mono: "'Courier New', Courier, monospace",
} as const;

/** The built-in fonts the file's watermarks and page numbers are measured in, as Save does. */
// pdf-lib's own font names are the same strings, under another type.
type FontName = Parameters<typeof StandardFontEmbedder.for>[0];
const HELVETICA = StandardFontEmbedder.for(StandardFonts.Helvetica as unknown as FontName);
const HELVETICA_BOLD = StandardFontEmbedder.for(StandardFonts.HelveticaBold as unknown as FontName);

/** The page's own sizes and turn at scale 1: an SVG in these units zooms with the page by itself. */
interface PageView {
  div: HTMLElement;
  viewport: {
    clone: (o: { scale: number }) => {
      width: number;
      height: number;
      transform: number[];
      rotation: number;
    };
  };
}

/** Pages that edits touch: one page for most, every listed page for a watermark or numbers. */
function pagesOf(e: PageEdits): Set<number> {
  const pages = new Set<number>();
  for (const w of e.words) pages.add(w.page);
  for (const l of e.lines) pages.add(l.page);
  for (const t of e.things) pages.add(t.area.page);
  for (const s of e.stamps) for (const n of s.o.pages) pages.add(n);
  return pages;
}

/**
 * The edits not yet in the file, drawn over the pages as they're shown: under the text layer, so the
 * words can still be selected, and over the page's picture. Drawn as the file will have them (same
 * face, size, place and colours), so Save changes nothing that's seen.
 */
export function pageEditLayer(viewer: PDFViewer, dark: boolean) {
  let edits: PageEdits = NO_EDITS;
  const drawn = new Map<number, SVGSVGElement>();
  const doc = viewer.container.ownerDocument;
  const urls = new Map<Uint8Array, string>();
  const view = (n: number) => viewer.getPageView(n - 1) as PageView | undefined;
  const el = <K extends keyof SVGElementTagNameMap>(
    tag: K,
    attrs: Record<string, string | number>,
  ) => {
    const e = doc.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    return e;
  };
  const urlOf = (bytes: Uint8Array, type: string) => {
    let u = urls.get(bytes);
    if (!u) {
      u = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
      urls.set(bytes, u);
    }
    return u;
  };
  // Widths measured on a canvas in the same font, for spacing that follows the old words.
  const measure = doc.createElement("canvas").getContext("2d");
  const widthOf = (text: string, font: string) => {
    if (!measure) return text.length;
    measure.font = font;
    return measure.measureText(text).width;
  };

  /** One added thing, in the page's own points (y up), as draw.ts writes it. */
  const thing = (t: Addition, g: SVGGElement) => {
    const { x, y, width, height } = t.area;
    if (t.kind === "cover") {
      g.append(el("rect", { x, y, width, height, fill: asShown(t.color, dark) }));
    } else if (t.kind === "text") {
      const family = t.face?.css ?? GENERIC_CSS[t.font ?? "sans"];
      const weight = t.bold ? 700 : 400;
      const style = t.italic ? "italic" : "normal";
      const font = `${style} ${weight} 100px ${family}`;
      const lines = t.text.split("\n");
      lines.forEach((line, i) => {
        const base =
          t.baseline !== undefined && lines.length === 1
            ? t.baseline
            : y + height - t.size * 0.8 - i * t.size * 1.2;
        // As in the file: to a width, or with the old words' spacing between letters.
        const natural = (widthOf(line, font) * t.size) / 100;
        const length = t.fit
          ? t.fit
          : t.track
            ? (natural * t.track.width) /
              Math.max(0.01, (widthOf(t.track.text, font) * t.size) / 100)
            : 0;
        const text = el("text", {
          transform: `translate(${x} ${base}) scale(1 -1)`,
          "font-size": t.size,
          "font-family": family,
          "font-weight": weight,
          "font-style": style,
          fill: asShown(t.color, dark),
          ...(length ? { textLength: length, lengthAdjust: "spacingAndGlyphs" } : {}),
        });
        text.textContent = line;
        g.append(text);
      });
    } else if (t.kind === "image") {
      const img = el("image", {
        width,
        height,
        preserveAspectRatio: "none",
        transform: `translate(${x} ${y + height}) scale(1 -1)`,
        ...(t.opacity !== undefined ? { opacity: t.opacity } : {}),
      });
      img.setAttribute("href", urlOf(t.bytes, t.type === "png" ? "image/png" : "image/jpeg"));
      g.append(img);
    } else if (t.kind === "shape") {
      const def = SHAPES.find((d) => d.id === t.shape);
      if (!def) return;
      const stroke = asShown(t.stroke, dark);
      // Drawn y-down from its top-left, as the file has it; a flip mirrors it in its box.
      const box = el("g", {
        transform: `translate(${x} ${y + height}) scale(1 -1) translate(${t.flipX ? width : 0} ${t.flipY ? height : 0}) scale(${t.flipX ? -1 : 1} ${t.flipY ? -1 : 1})`,
      });
      box.append(
        el("path", {
          d: def.path(width, height),
          fill: t.fill && !def.open ? asShown(t.fill, dark) : "none",
          stroke,
          "stroke-width": t.width,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        }),
      );
      for (const d of arrowHeads(def.id, width, height, t.width))
        box.append(el("path", { d, fill: stroke, stroke, "stroke-width": t.width / 2 }));
      g.append(box);
    } else if (t.kind === "rect" || t.kind === "ellipse") {
      const attrs = {
        fill: t.fill ? asShown(t.fill, dark) : "none",
        stroke: asShown(t.stroke, dark),
        "stroke-width": t.width,
      };
      g.append(
        t.kind === "rect"
          ? el("rect", { x, y, width, height, ...attrs })
          : el("ellipse", {
              cx: x + width / 2,
              cy: y + height / 2,
              rx: width / 2,
              ry: height / 2,
              ...attrs,
            }),
      );
    } else if (t.kind === "line") {
      g.append(
        el("line", {
          x1: x,
          y1: y + height,
          x2: x + width,
          y2: y,
          stroke: asShown(t.stroke, dark),
          "stroke-width": t.width,
        }),
      );
    }
  };

  /** A watermark or a page number, on the page as seen (y down here), as stamp.ts places it. */
  const stamp = (s: Stamp, n: number, seen: { width: number; height: number }, g: SVGGElement) => {
    const i = s.o.pages.indexOf(n);
    if (i < 0) return;
    if (s.kind === "numbers") {
      const o = s.o;
      const total = o.start + o.pages.length - 1;
      const text = numberText(o.format, o.start + i, total);
      const { u, v } = numberSpot(seen, o, HELVETICA.widthOfTextAtSize(text, o.size));
      const t = el("text", {
        x: u,
        y: seen.height - v,
        "font-size": o.size,
        "font-family": GENERIC_CSS.sans,
        fill: asShown(o.color, dark),
      });
      t.textContent = text;
      g.append(t);
      return;
    }
    const o = s.o;
    const image = o.image;
    const aspect = image ? imageAspect(image.bytes) : undefined;
    const { w, h, size, u, v } = watermarkSpot(
      seen,
      o,
      image
        ? { aspect: aspect ?? 1 }
        : { widthAt1: HELVETICA_BOLD.widthOfTextAtSize(o.text ?? "", 1) },
    );
    const turn = `translate(${u} ${seen.height - v}) rotate(${-o.angle})`;
    if (image) {
      const img = el("image", {
        width: w,
        height: h,
        opacity: o.opacity,
        preserveAspectRatio: "none",
        transform: `${turn} translate(0 ${-h})`,
      });
      img.setAttribute(
        "href",
        urlOf(image.bytes, image.type === "png" ? "image/png" : "image/jpeg"),
      );
      g.append(img);
    } else {
      const t = el("text", {
        transform: turn,
        "font-size": size,
        "font-family": GENERIC_CSS.sans,
        "font-weight": 700,
        fill: asShown(o.color, dark),
        opacity: o.opacity,
      });
      t.textContent = o.text ?? "";
      g.append(t);
    }
  };

  const make = (n: number, page: PageView) => {
    const vp = page.viewport.clone({ scale: 1 });
    const svg = el("svg", {
      class: "pwPageEdits",
      viewBox: `0 0 ${vp.width} ${vp.height}`,
      preserveAspectRatio: "none",
      "aria-hidden": "true",
    });
    // From the page's points (y up) to where they're seen, turned with the page.
    const g = el("g", { transform: `matrix(${vp.transform.join(" ")})` });
    for (const w of edits.words) if (w.page === n) for (const t of wordThings(w)) thing(t, g);
    for (const t of edits.things) if (t.area.page === n) thing(t, g);
    for (const l of edits.lines) {
      if (l.page !== n) continue;
      const [x0, y0, x1, y1] = l.box;
      const h = y1 - y0;
      // As the PDF's text markup draws them (markup.ts).
      g.append(
        el("rect", {
          x: x0,
          y: l.kind === "underline" ? y0 + h * 0.08 : y0 + h * 0.45,
          width: x1 - x0,
          height: Math.max(0.6, h * 0.07),
          fill: asShown(MARK_COLORS[l.kind], dark),
        }),
      );
    }
    svg.append(g);
    if (edits.stamps.length) {
      const seen = el("g", {});
      for (const s of edits.stamps) stamp(s, n, vp, seen);
      svg.append(seen);
    }
    return svg;
  };

  // pdf.js empties a page's box when it draws it again or lets it go, so each layer is put back,
  // straight after the page's picture, whenever the pages change.
  const place = () => {
    for (const n of pagesOf(edits)) {
      const page = view(n);
      if (!page?.div) continue;
      let svg = drawn.get(n);
      if (!svg) {
        svg = make(n, page);
        drawn.set(n, svg);
      }
      const picture = page.div.querySelector(":scope > .canvasWrapper");
      if (picture ? picture.nextSibling !== svg : svg.parentNode !== page.div) {
        if (picture) picture.after(svg);
        else page.div.append(svg);
      }
    }
  };
  const watch = new MutationObserver(place);
  watch.observe(viewer.container, { childList: true, subtree: true });

  const clear = () => {
    for (const svg of drawn.values()) svg.remove();
    drawn.clear();
  };
  return {
    set(next: PageEdits) {
      clear();
      edits = next;
      place();
    },
    destroy() {
      watch.disconnect();
      clear();
      for (const u of urls.values()) URL.revokeObjectURL(u);
      urls.clear();
    },
  };
}

/** A PNG's or JPEG's width over its height, from its header. */
function imageAspect(bytes: Uint8Array): number | undefined {
  const at = (i: number) => bytes[i] ?? 0;
  if (at(0) === 0x89 && at(1) === 0x50) {
    const w = (at(16) << 24) | (at(17) << 16) | (at(18) << 8) | at(19);
    const h = (at(20) << 24) | (at(21) << 16) | (at(22) << 8) | at(23);
    return h ? w / h : undefined;
  }
  // JPEG: the first start-of-frame marker holds the size.
  for (let i = 2; i + 9 < bytes.length;) {
    if (at(i) !== 0xff) return undefined;
    const marker = at(i + 1);
    const length = (at(i + 2) << 8) | at(i + 3);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const h = (at(i + 5) << 8) | at(i + 6);
      const w = (at(i + 7) << 8) | at(i + 8);
      return h ? w / h : undefined;
    }
    i += 2 + length;
  }
  return undefined;
}
