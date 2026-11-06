import fontkit from "@pdf-lib/fontkit";
import type { PDFPageProxy, TextContent, TextItem } from "pdfjs-dist/types/src/display/api";
import type { PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import type { Generic } from "./fontMatch";
import type { Box } from "./selectionBoxes";

/**
 * What words on a page were set in, read from the PDF itself rather than guessed from the screen:
 * the font's own name, its size and the line's baseline. Edits are written to match.
 */
export interface RunFont {
  /** The PDF's name for the font, such as "BCDEEE+Calibri-Bold"; null when it can't be read. */
  name: string | null;
  generic: Generic;
  bold: boolean;
  italic: boolean;
  size: number;
  baseline: number;
}

/** pdf.js's loaded font, as far as it's read here. */
export interface LoadedFont {
  bold?: boolean;
  italic?: boolean;
  black?: boolean;
  fallbackName?: string;
  /** The font file pdf.js made of it, kept by the fontExtraProperties option. */
  data?: Uint8Array | null;
}

const names = new WeakMap<object, string | null>();

/**
 * The font's own name. pdf.js doesn't hand it out, but the file it makes of each font carries the
 * original name in its name table, which fontkit reads.
 */
export function nameOf(font: LoadedFont): string | null {
  if (names.has(font)) return names.get(font) ?? null;
  let name: string | null = null;
  try {
    if (font.data) {
      const parsed = fontkit.create(font.data as unknown as Buffer) as {
        postscriptName?: string;
        familyName?: string;
        subfamilyName?: string;
      };
      name =
        parsed.postscriptName ||
        [parsed.familyName, parsed.subfamilyName].filter(Boolean).join("-") ||
        null;
    }
  } catch {
    // Unreadable: the kind of type is still known from pdf.js.
  }
  names.set(font, name);
  return name;
}

const contents = new WeakMap<PDFPageProxy, Promise<TextContent>>();

function textOf(page: PDFPageProxy) {
  let c = contents.get(page);
  if (!c) {
    c = page.getTextContent();
    contents.set(page, c);
  }
  return c;
}

const overlap = (a0: number, a1: number, b0: number, b1: number) =>
  Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/** The text item under a box on a page (in the page's own coordinates), and its font. */
export async function runFont(
  viewer: PDFViewer,
  pageNumber: number,
  box: Box,
): Promise<RunFont | null> {
  const view = viewer.getPageView(pageNumber - 1) as { pdfPage?: PDFPageProxy } | undefined;
  const page = view?.pdfPage;
  if (!page) return null;
  const content = await textOf(page);
  const [x0, y0, x1, y1] = box;
  let best: TextItem | null = null;
  let score = 0;
  for (const item of content.items) {
    if (!("str" in item) || !item.str.trim()) continue;
    const [a, b, c, d, e, f] = item.transform as number[];
    // Upright text only: its baseline at f, running from e for its width.
    if (Math.abs(b ?? 0) > 0.01 || Math.abs(c ?? 0) > 0.01) continue;
    const size = Math.abs(d ?? 0) || Math.abs(a ?? 0);
    const across = overlap(x0, x1, e ?? 0, (e ?? 0) + item.width);
    const down = overlap(y0, y1, (f ?? 0) - size * 0.25, (f ?? 0) + size * 0.9);
    const s = across * down;
    if (s > score) {
      score = s;
      best = item;
    }
  }
  if (!best) return null;
  const [, , , d, , f] = best.transform as number[];
  const size = Math.abs(d ?? 0);
  const loaded: LoadedFont | null = page.commonObjs.has(best.fontName)
    ? (page.commonObjs.get(best.fontName) as LoadedFont)
    : null;
  const family = `${content.styles[best.fontName]?.fontFamily ?? ""} ${loaded?.fallbackName ?? ""}`;
  const generic: Generic = /mono/.test(family)
    ? "mono"
    : /serif/.test(family) && !/sans-serif/.test(family)
      ? "serif"
      : "sans";
  const name = loaded ? nameOf(loaded) : null;
  return {
    name,
    generic,
    bold: !!loaded?.bold || !!loaded?.black || /bold|black|heavy|semibold/i.test(name ?? ""),
    italic: !!loaded?.italic || /italic|oblique/i.test(name ?? ""),
    size,
    baseline: f ?? y0,
  };
}
