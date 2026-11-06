import {
  degrees,
  PDFName,
  setCharacterSqueeze,
  StandardFonts,
  type PDFDocument,
  type PDFFont,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { arrowHeads, SHAPES } from "./shapes";
import { isolate, hexColor, seen } from "./stamp";
import { load, save } from "./pages";

/**
 * Edit and Sign: things added on top of pages. Areas are in the page's own coordinates (what a drag
 * on screen converts to); text and pictures are turned with the page so they read upright on it.
 */

export interface Area {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Addition =
  | {
      kind: "text";
      area: Area;
      text: string;
      size: number;
      color: string;
      /** Edit text matches the words it replaces; otherwise the plain sans. */
      font?: "sans" | "serif" | "mono";
      bold?: boolean;
      italic?: boolean;
      /** Squeezed or stretched to exactly this width: restyled words keep their place on the line. */
      fit?: number;
      /**
       * The font the words were set in, installed on this PC: its name on Windows' list (a key into
       * the fonts handed to addThings) and its CSS family, for drawing it on screen until it's saved.
       */
      face?: { css: string; installed?: string };
      /** Where the old words' baseline was, so new words sit exactly on it (one line, unturned). */
      baseline?: number;
      /** The old words and their width: new ones get the same spacing between letters. */
      track?: { text: string; width: number };
    }
  | {
      kind: "shape";
      area: Area;
      shape: string;
      stroke: string;
      fill: string | null;
      width: number;
      /** Which way it was dragged, for lines and arrows. */
      flipX?: boolean;
      flipY?: boolean;
    }
  /** A plain box with no edge: what Edit text paints over the words it replaces. */
  | { kind: "cover"; area: Area; color: string }
  | { kind: "image"; area: Area; bytes: Uint8Array; type: "png" | "jpg"; opacity?: number }
  | { kind: "rect" | "ellipse"; area: Area; stroke: string; fill: string | null; width: number }
  | { kind: "line"; area: Area; stroke: string; width: number }
  | { kind: "field"; area: Area; field: "text" | "check"; name: string };

/** Plain, bold, italic, bold italic: the built-in PDF fonts of each kind. */
const FACES: Record<string, [StandardFonts, StandardFonts, StandardFonts, StandardFonts]> = {
  sans: [
    StandardFonts.Helvetica,
    StandardFonts.HelveticaBold,
    StandardFonts.HelveticaOblique,
    StandardFonts.HelveticaBoldOblique,
  ],
  serif: [
    StandardFonts.TimesRoman,
    StandardFonts.TimesRomanBold,
    StandardFonts.TimesRomanItalic,
    StandardFonts.TimesRomanBoldItalic,
  ],
  mono: [
    StandardFonts.Courier,
    StandardFonts.CourierBold,
    StandardFonts.CourierOblique,
    StandardFonts.CourierBoldOblique,
  ],
};

async function fontOf(
  doc: PDFDocument,
  cache: Map<string, PDFFont>,
  face: string,
  bold: boolean,
  italic: boolean,
) {
  const key = `${face}-${bold ? "b" : ""}${italic ? "i" : ""}`;
  let f = cache.get(key);
  if (!f) {
    const faces = FACES[face] ?? FACES.sans;
    const pick = faces?.[(bold ? 1 : 0) + (italic ? 2 : 0)] ?? StandardFonts.Helvetica;
    f = await doc.embedFont(pick);
    cache.set(key, f);
  }
  return f;
}

/** Mirrors an SVG path's numbers: x and y alternate after each command (no arcs are used). */
function mirror(d: string, sx: number, sy: number): string {
  let i = 0;
  return d.replace(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g, (tok) => {
    if (/[A-Za-z]/.test(tok)) {
      i = 0;
      return tok;
    }
    const v = Number(tok) * (i++ % 2 === 0 ? sx : sy);
    return String(+v.toFixed(2));
  });
}

/** Only letters the built-in PDF font has can be typed as text; anything else goes in as a picture. */
export function plainText(text: string): boolean {
  return /^[\x20-\x7e\xa0-\xff\n]*$/.test(text);
}

/**
 * `installed` holds the files of installed fonts that text uses, by their name on Windows' list.
 * Each goes in once, with only the letters used; one that won't load falls back to the built-in.
 */
export async function addThings(
  bytes: Uint8Array,
  things: Addition[],
  installed: Record<string, Uint8Array> = {},
): Promise<Uint8Array> {
  const doc = await load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fonts = new Map<string, PDFFont>();
  if (Object.keys(installed).length) doc.registerFontkit(fontkit);
  const fontFor = async (t: {
    font?: string;
    bold?: boolean;
    italic?: boolean;
    face?: { installed?: string };
  }) => {
    const name = t.face?.installed;
    const file = name ? installed[name] : undefined;
    if (name && file) {
      const key = `installed:${name}`;
      const known = fonts.get(key);
      if (known) return known;
      try {
        const embedded = await doc.embedFont(file, { subset: true });
        fonts.set(key, embedded);
        return embedded;
      } catch {
        // Not a font pdf-lib can carry: the built-in of its kind instead.
      }
    }
    return fontOf(doc, fonts, t.font ?? "sans", !!t.bold, !!t.italic);
  };
  const pages = doc.getPages();
  const isolated = new Set<number>();
  let fieldCount = 0;
  for (const t of things) {
    const page = pages[t.area.page - 1];
    if (!page) continue;
    if (!isolated.has(t.area.page) && t.kind !== "field") {
      isolate(doc, page);
      isolated.add(t.area.page);
    }
    const { x, y, width, height } = t.area;
    const turn = seen(page).turn;
    if (t.kind === "text") {
      const lines = t.text.split("\n");
      const lineH = t.size * 1.2;
      // The first line's baseline, at the top of the box as the page is seen.
      for (const [i, line] of lines.entries()) {
        const down = t.size * 0.8 + i * lineH;
        const exact = t.baseline !== undefined && turn === 0 && lines.length === 1;
        const [px, py] = exact
          ? [x, t.baseline as number]
          : turn === 90
            ? [x + down, y]
            : turn === 180
              ? [x + width, y + down]
              : turn === 270
                ? [x + width - down, y + height]
                : [x, y + height - down];
        const face = await fontFor(t);
        // Tz stretches the letters' spacing; it stays set until put back, so it's put back after.
        // To a width, or with the old words' spacing between letters.
        const natural = face.widthOfTextAtSize(line, t.size);
        const squeeze = t.fit
          ? (t.fit / Math.max(1, natural)) * 100
          : t.track
            ? (t.track.width / Math.max(1, face.widthOfTextAtSize(t.track.text, t.size))) * 100
            : 0;
        if (squeeze) page.pushOperators(setCharacterSqueeze(+squeeze.toFixed(2)));
        page.drawText(line, {
          x: px,
          y: py,
          size: t.size,
          font: face,
          color: hexColor(t.color),
          rotate: degrees(turn),
        });
        if (squeeze) page.pushOperators(setCharacterSqueeze(100));
      }
    } else if (t.kind === "cover") {
      page.drawRectangle({ x, y, width, height, color: hexColor(t.color) });
    } else if (t.kind === "shape") {
      const def = SHAPES.find((d) => d.id === t.shape);
      if (!def) continue;
      // Drawn in a box y-down from its top-left; a flip mirrors it inside that box.
      const sx = t.flipX ? -1 : 1;
      const sy = t.flipY ? -1 : 1;
      const at = { x: t.flipX ? x + width : x, y: t.flipY ? y : y + height, scale: 1 };
      const stroke = hexColor(t.stroke);
      const flip = (d: string) => (sx === 1 && sy === 1 ? d : mirror(d, sx, sy));
      page.drawSvgPath(flip(def.path(width, height)), {
        ...at,
        borderColor: stroke,
        borderWidth: t.width,
        borderLineCap: 1,
        ...(t.fill && !def.open ? { color: hexColor(t.fill) } : {}),
      });
      for (const d of arrowHeads(def.id, width, height, t.width))
        page.drawSvgPath(flip(d), {
          ...at,
          color: stroke,
          borderColor: stroke,
          borderWidth: t.width / 2,
        });
    } else if (t.kind === "image") {
      const image = t.type === "png" ? await doc.embedPng(t.bytes) : await doc.embedJpg(t.bytes);
      const sideways = turn === 90 || turn === 270;
      const [w, h] = sideways ? [height, width] : [width, height];
      const [px, py] =
        turn === 90
          ? [x + width, y]
          : turn === 180
            ? [x + width, y + height]
            : turn === 270
              ? [x, y + height]
              : [x, y];
      page.drawImage(image, {
        x: px,
        y: py,
        width: w,
        height: h,
        rotate: degrees(turn),
        opacity: t.opacity ?? 1,
      });
    } else if (t.kind === "rect") {
      page.drawRectangle({
        x,
        y,
        width,
        height,
        borderColor: hexColor(t.stroke),
        borderWidth: t.width,
        ...(t.fill ? { color: hexColor(t.fill) } : {}),
      });
    } else if (t.kind === "ellipse") {
      page.drawEllipse({
        x: x + width / 2,
        y: y + height / 2,
        xScale: width / 2,
        yScale: height / 2,
        borderColor: hexColor(t.stroke),
        borderWidth: t.width,
        ...(t.fill ? { color: hexColor(t.fill) } : {}),
      });
    } else if (t.kind === "line") {
      page.drawLine({
        start: { x, y: y + height },
        end: { x: x + width, y },
        thickness: t.width,
        color: hexColor(t.stroke),
      });
    } else if (t.kind === "field") {
      const form = doc.getForm();
      const name = t.name || `Field ${++fieldCount}`;
      let unique = name;
      for (let i = 2; form.getFields().some((f) => f.getName() === unique); i++)
        unique = `${name} ${i}`;
      if (t.field === "check") form.createCheckBox(unique).addToPage(page, { x, y, width, height });
      else form.createTextField(unique).addToPage(page, { x, y, width, height, font });
    }
  }
  if (things.some((t) => t.kind === "field")) doc.getForm().updateFieldAppearances(font);
  return save(doc);
}

/**
 * Redact: the page becomes a picture of itself with the areas blacked out, so the hidden text is
 * gone from the file, not just covered. Links and notes on the page go too.
 */
export async function redactPages(
  bytes: Uint8Array,
  pictures: { page: number; jpg: Uint8Array }[],
): Promise<Uint8Array> {
  const doc = await load(bytes);
  const pages = doc.getPages();
  for (const p of pictures) {
    const page = pages[p.page - 1];
    if (!page) continue;
    const image = await doc.embedJpg(p.jpg);
    const box = page.getCropBox();
    const turn = seen(page).turn;
    const empty = doc.context.register(doc.context.flateStream(new Uint8Array()));
    page.node.set(PDFName.of("Contents"), empty);
    page.node.set(PDFName.of("Resources"), doc.context.obj({}));
    page.node.delete(PDFName.of("Annots"));
    // The picture was taken of the page as seen, so it goes in turned back.
    const sideways = turn === 90 || turn === 270;
    const [w, h] = sideways ? [box.height, box.width] : [box.width, box.height];
    const [px, py] =
      turn === 90
        ? [box.x + box.width, box.y]
        : turn === 180
          ? [box.x + box.width, box.y + box.height]
          : turn === 270
            ? [box.x, box.y + box.height]
            : [box.x, box.y];
    page.drawImage(image, { x: px, y: py, width: w, height: h, rotate: degrees(turn) });
  }
  return save(doc);
}
