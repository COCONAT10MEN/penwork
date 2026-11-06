import type { PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import { asShown } from "./pageColors";
import { MARK_COLORS } from "./selectionBoxes";
import type { Face, TextStyles } from "./textStyles";

const SVG = "http://www.w3.org/2000/svg";
const FAMILY: Record<Face, string> = {
  sans: "Helvetica, Arial, sans-serif",
  serif: "'Times New Roman', Times, serif",
  mono: "'Courier New', Courier, monospace",
};

/** The page's own sizes and turn at scale 1: an SVG in these units zooms with the page by itself. */
interface PageView {
  div: HTMLElement;
  viewport: {
    clone: (o: { scale: number }) => { width: number; height: number; transform: number[] };
  };
}

/**
 * The text styles not yet in the file, drawn over the pages as they're shown: under the text layer,
 * so the words can still be selected, and over the page's picture. Written as the file would be
 * (same face, size, width and colours), so Save changes nothing that's seen.
 */
export function textStyleLayer(viewer: PDFViewer, dark: boolean) {
  let styles: TextStyles = { words: [], lines: [] };
  const drawn = new Map<number, SVGSVGElement>();
  const doc = viewer.container.ownerDocument;
  const view = (n: number) => viewer.getPageView(n - 1) as PageView | undefined;

  const make = (n: number, page: PageView) => {
    const vp = page.viewport.clone({ scale: 1 });
    const el = <K extends keyof SVGElementTagNameMap>(
      tag: K,
      attrs: Record<string, string | number>,
    ) => {
      const e = doc.createElementNS(SVG, tag);
      for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
      return e;
    };
    const svg = el("svg", {
      class: "pwTextStyles",
      viewBox: `0 0 ${vp.width} ${vp.height}`,
      preserveAspectRatio: "none",
      "aria-hidden": "true",
    });
    // From the page's points (y up) to where they're seen, turned with the page.
    const g = el("g", { transform: `matrix(${vp.transform.join(" ")})` });
    for (const w of styles.words) {
      if (w.page !== n) continue;
      const [x0, y0, x1, y1] = w.box;
      const size = y1 - y0;
      g.append(
        el("rect", {
          x: x0 - 0.4,
          y: y0 - 0.4,
          width: x1 - x0 + 0.8,
          height: size + 0.8,
          fill: asShown(w.paper, dark),
        }),
      );
      // The baseline where the file's text goes; flipped back upright for drawing.
      const text = el("text", {
        transform: `translate(${x0} ${y0 + size * 0.2}) scale(1 -1)`,
        "font-size": size,
        "font-family": FAMILY[w.mono ? "mono" : w.font],
        "font-weight": w.bold ? 700 : 400,
        "font-style": w.italic ? "italic" : "normal",
        fill: asShown(w.ink, dark),
        textLength: x1 - x0,
        lengthAdjust: "spacingAndGlyphs",
      });
      text.textContent = w.text;
      g.append(text);
    }
    for (const l of styles.lines) {
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
    return svg;
  };

  // pdf.js empties a page's box when it draws it again or lets it go, so each layer is put back,
  // straight after the page's picture, whenever the pages change.
  const place = () => {
    const pages = new Set([...styles.words.map((w) => w.page), ...styles.lines.map((l) => l.page)]);
    for (const n of pages) {
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
    set(next: TextStyles) {
      clear();
      styles = next;
      place();
    },
    destroy() {
      watch.disconnect();
      clear();
    },
  };
}
