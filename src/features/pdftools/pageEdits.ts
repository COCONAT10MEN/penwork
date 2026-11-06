import type { Addition } from "../../lib/pdftools/draw";
import { plainText } from "../../lib/pdftools/draw";
import type { Mark } from "../../lib/pdftools/markup";
import type { NumberOptions, WatermarkOptions } from "../../lib/pdftools/stamp";
import { runTool } from "./client";
import { faceFor, fontFiles, type Face, type Generic } from "./fontMatch";
import { textPicture } from "./pdfRead";
import type { RunFont } from "./runFont";
import { MARK_COLORS, mergeLines, type Box } from "./selectionBoxes";

/**
 * Changes to what's on the pages, kept beside the file while it's open and drawn over the pages
 * (pageEditLayer.ts), so they show the moment they're made and nothing is opened again: styled
 * words, lines under or through words, added text, pictures, signatures and shapes, watermarks and
 * page numbers. They go into the file when it's written: on Save, or when a tool reads it.
 */

export type TextStyle = "bold" | "italic" | "mono" | "underline" | "strike";

/** A selected run, read off the page before the selection goes. Boxes are in the page's points. */
export interface Picked {
  page: number;
  box: Box;
  text: string;
  /** The kind of type, from the screen, for when the PDF's font can't be read. */
  font: Generic;
  /** Colours as printed (not as dark pages show them). */
  paper: string;
  ink: string;
  /** The font the words are set in, read from the PDF. */
  run?: RunFont | null;
}

/** Words written again in another face, over the old ones in the paper's colour. */
export interface Restyled extends Picked {
  bold: boolean;
  italic: boolean;
  mono: boolean;
  /** How they're drawn, for that look. */
  face?: Face;
}

/** A line under or through words. */
export interface Lined {
  page: number;
  box: Box;
  kind: "underline" | "strike";
}

/** Across pages: a watermark, or page numbers. */
export type Stamp =
  { kind: "watermark"; o: WatermarkOptions } | { kind: "numbers"; o: NumberOptions };

export interface PageEdits {
  words: Restyled[];
  lines: Lined[];
  /** Text, pictures, signatures, shapes and the paint under edited words, in the order added. */
  things: Addition[];
  stamps: Stamp[];
}

export const NO_EDITS: PageEdits = { words: [], lines: [], things: [], stamps: [] };

export const isEmpty = (e: PageEdits) =>
  !e.words.length && !e.lines.length && !e.things.length && !e.stamps.length;

const area = (b: Box) => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
const overlap = (a: Box, b: Box) =>
  area([Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])]);
/** Most of `inner` lies in `outer`. */
const within = (inner: Box, outer: Box) => overlap(inner, outer) > 0.8 * area(inner);
const same = (a: Box, b: Box) => within(a, b) && within(b, a);

/** How a run looks in the file now: its own font's weight and slant. */
const ownLook = (p: Picked) => ({
  bold: p.run?.bold ?? false,
  italic: p.run?.italic ?? false,
  mono: (p.run?.generic ?? p.font) === "mono",
});

/**
 * The edits with a style applied to the picked runs. Like any formatting bar it toggles: when
 * every picked run has the style already (their own font's, or one given here), it comes off.
 * `on` says which it was. Faces for the new looks are found after, by withFaces.
 */
export function applyStyle(
  s: PageEdits,
  picked: Picked[],
  style: TextStyle,
): { edits: PageEdits; on: boolean } {
  if (style === "underline" || style === "strike") {
    const marked = (p: Picked, l: Lined) =>
      l.kind === style && l.page === p.page && within(p.box, l.box);
    const has = (p: Picked) => s.lines.some((l) => marked(p, l));
    if (picked.every(has))
      return {
        edits: { ...s, lines: s.lines.filter((l) => !picked.some((p) => marked(p, l))) },
        on: false,
      };
    const added = picked
      .filter((p) => !has(p))
      .map((p) => ({ page: p.page, box: p.box, kind: style }));
    return { edits: { ...s, lines: [...s.lines, ...added] }, on: true };
  }
  // A run's look so far: the newest restyled run it sits in, or its own font's.
  const lookOf = (p: Picked) => {
    const under = [...s.words].reverse().find((w) => w.page === p.page && within(p.box, w.box));
    return under ? { bold: under.bold, italic: under.italic, mono: under.mono } : ownLook(p);
  };
  const on = !picked.every((p) => lookOf(p)[style]);
  let words = s.words;
  for (const p of picked) {
    const look = { ...lookOf(p), [style]: on };
    // The same run restyled again replaces itself instead of piling up.
    words = words.filter((w) => !(w.page === p.page && same(w.box, p.box)));
    const own = ownLook(p);
    const asItWas = look.bold === own.bold && look.italic === own.italic && look.mono === own.mono;
    // As it was: nothing to draw, unless it's a part of a longer run that stays styled.
    const inStyled = words.some((w) => w.page === p.page && overlap(w.box, p.box) > 0);
    if (!asItWas || inStyled) words = [...words, { ...p, ...look }];
  }
  return { edits: { ...s, words }, on };
}

/** Finds the face for each restyled run that hasn't one for its look yet. */
export async function withFaces(s: PageEdits): Promise<PageEdits> {
  const words = await Promise.all(
    s.words.map(async (w) => {
      const f = w.face;
      if (f && f.bold === w.bold && f.italic === w.italic && (f.generic === "mono") === w.mono)
        return w;
      const face = await faceFor(w.run?.name ?? null, w.run?.generic ?? w.font, {
        bold: w.bold,
        italic: w.italic,
        mono: w.mono,
      });
      return { ...w, face };
    }),
  );
  return { ...s, words };
}

/** Writing that needs shaping or runs right to left goes in as a picture of itself. */
const COMPLEX = /[\u0590-\u08ff\u0900-\u0dff\ufb1d-\ufdff\ufe70-\ufeff]/;

/** A restyled run as things to draw: paint over the old words, then the words in their new face. */
export function wordThings(w: Restyled): Addition[] {
  const [x0, y0, x1, y1] = w.box;
  const size = w.run?.size ?? y1 - y0;
  const width = x1 - x0;
  return [
    {
      kind: "cover",
      area: { page: w.page, x: x0 - 0.4, y: y0 - 0.4, width: width + 0.8, height: y1 - y0 + 0.8 },
      color: w.paper,
    },
    {
      kind: "text",
      area: { page: w.page, x: x0, y: y0, width, height: y1 - y0 },
      text: w.text,
      size,
      color: w.ink,
      font: w.face?.generic ?? (w.mono ? "mono" : w.font),
      bold: w.bold,
      italic: w.italic,
      fit: width,
      ...(w.face ? { face: { css: w.face.css, installed: w.face.installed } } : {}),
      ...(w.run ? { baseline: w.run.baseline } : {}),
    },
  ];
}

/** Text that can't go in as text (no installed font, and not what the built-in fonts hold). */
const asPicture = (t: Extract<Addition, { kind: "text" }>) =>
  COMPLEX.test(t.text) || (!t.face?.installed && !plainText(t.text));

/** The file with the edits written in. */
export async function bakeEdits(bytes: Uint8Array, s: PageEdits): Promise<Uint8Array> {
  if (isEmpty(s)) return bytes;
  const things: Addition[] = [];
  for (const t of [...s.words.flatMap(wordThings), ...s.things]) {
    if (t.kind !== "text" || !asPicture(t)) {
      things.push(t);
      continue;
    }
    const pic = await textPicture(t.text, {
      size: t.size,
      color: t.color,
      bold: t.bold,
      italic: t.italic,
      ...(t.face ? { font: t.face.css } : {}),
    });
    things.push({ kind: "image", area: t.area, bytes: pic.bytes, type: "png" });
  }
  const marks: Mark[] = [];
  for (const kind of ["underline", "strike"] as const) {
    const byPage = new Map<number, Box[]>();
    for (const l of s.lines)
      if (l.kind === kind) byPage.set(l.page, [...(byPage.get(l.page) ?? []), l.box]);
    for (const [page, boxes] of byPage)
      marks.push({ page, kind, color: MARK_COLORS[kind], boxes: mergeLines(boxes) });
  }
  let out = bytes;
  if (things.length) {
    const fonts = await fontFiles(
      things.flatMap((t) => (t.kind === "text" && t.face?.installed ? [t.face.installed] : [])),
    );
    out = await runTool("addThings", [out, things, fonts]);
  }
  if (marks.length) out = await runTool("addMarks", [out, marks]);
  for (const stamp of s.stamps)
    out =
      stamp.kind === "watermark"
        ? await runTool("addWatermark", [out, stamp.o])
        : await runTool("addPageNumbers", [out, stamp.o]);
  return out;
}
