import type { Addition } from "../../lib/pdftools/draw";
import { plainText } from "../../lib/pdftools/draw";
import type { Mark } from "../../lib/pdftools/markup";
import { runTool } from "./client";
import { textPicture } from "./pdfRead";
import { MARK_COLORS, mergeLines, type Box } from "./selectionBoxes";

/**
 * Bold, italic, monospace, underline and strike through for selected words. They show on the page
 * at once, drawn over it (textStyleLayer.ts), and go into the file only when it's written: on Save,
 * or when a tool reads the file. Nothing is reloaded for a word made bold.
 */

export type TextStyle = "bold" | "italic" | "mono" | "underline" | "strike";
export type Face = "sans" | "serif" | "mono";

/** A selected run, read off the page before the selection goes. Boxes are in the page's points. */
export interface Picked {
  page: number;
  box: Box;
  text: string;
  /** The kind of type it's set in now. */
  font: Face;
  /** Colours as printed (not as dark pages show them). */
  paper: string;
  ink: string;
}

/** Words written again in another face, over the old ones in the paper's colour. */
export interface Restyled extends Picked {
  bold: boolean;
  italic: boolean;
  mono: boolean;
}

/** A line under or through words. */
export interface Lined {
  page: number;
  box: Box;
  kind: "underline" | "strike";
}

export interface TextStyles {
  words: Restyled[];
  lines: Lined[];
}

export const NO_STYLES: TextStyles = { words: [], lines: [] };

const area = (b: Box) => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
const overlap = (a: Box, b: Box) =>
  area([Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])]);
/** Most of `inner` lies in `outer`. */
const within = (inner: Box, outer: Box) => overlap(inner, outer) > 0.8 * area(inner);
const same = (a: Box, b: Box) => within(a, b) && within(b, a);

/**
 * The styles with one more applied to the picked runs. Like any formatting bar it toggles: when
 * every picked run has the style already, it comes off. `on` says which it was.
 */
export function applyStyle(
  s: TextStyles,
  picked: Picked[],
  style: TextStyle,
): { styles: TextStyles; on: boolean } {
  if (style === "underline" || style === "strike") {
    const marked = (p: Picked, l: Lined) =>
      l.kind === style && l.page === p.page && within(p.box, l.box);
    const has = (p: Picked) => s.lines.some((l) => marked(p, l));
    if (picked.every(has))
      return {
        styles: { ...s, lines: s.lines.filter((l) => !picked.some((p) => marked(p, l))) },
        on: false,
      };
    const added = picked.filter((p) => !has(p)).map((p) => ({ page: p.page, box: p.box, kind: style }));
    return { styles: { ...s, lines: [...s.lines, ...added] }, on: true };
  }
  // A run's look so far: the newest restyled run it sits in, or plain.
  const lookOf = (p: Picked) => {
    const under = [...s.words].reverse().find((w) => w.page === p.page && within(p.box, w.box));
    return { bold: under?.bold ?? false, italic: under?.italic ?? false, mono: under?.mono ?? false };
  };
  const on = !picked.every((p) => lookOf(p)[style]);
  let words = s.words;
  for (const p of picked) {
    const look = { ...lookOf(p), [style]: on };
    // The same run restyled again replaces itself instead of piling up.
    words = words.filter((w) => !(w.page === p.page && same(w.box, p.box)));
    // Plain again: nothing to draw, unless it's a part of a longer run that stays styled.
    const inStyled = words.some((w) => w.page === p.page && overlap(w.box, p.box) > 0);
    if (look.bold || look.italic || look.mono || inStyled) words = [...words, { ...p, ...look }];
  }
  return { styles: { ...s, words }, on };
}

/** Courier and its kin, for the picture of text the PDF's own fonts can't show. */
const MONO = "'Courier New', Courier, monospace";

/** The file with the styles written in: words as text in the new face, lines as text markup. */
export async function bakeStyles(bytes: Uint8Array, s: TextStyles): Promise<Uint8Array> {
  if (!s.words.length && !s.lines.length) return bytes;
  const things: Addition[] = [];
  for (const w of s.words) {
    const [x0, y0, x1, y1] = w.box;
    const size = y1 - y0;
    const width = x1 - x0;
    things.push({
      kind: "cover",
      area: { page: w.page, x: x0 - 0.4, y: y0 - 0.4, width: width + 0.8, height: size + 0.8 },
      color: w.paper,
    });
    const at = { page: w.page, x: x0, y: y0, width, height: size };
    if (plainText(w.text))
      things.push({
        kind: "text",
        area: at,
        text: w.text,
        size,
        color: w.ink,
        font: w.mono ? "mono" : w.font,
        bold: w.bold,
        italic: w.italic,
        fit: width,
      });
    else {
      const pic = await textPicture(w.text, {
        size,
        color: w.ink,
        bold: w.bold,
        italic: w.italic,
        ...(w.mono ? { font: MONO } : {}),
      });
      things.push({ kind: "image", area: at, bytes: pic.bytes, type: "png" });
    }
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
  if (things.length) out = await runTool("addThings", [out, things]);
  if (marks.length) out = await runTool("addMarks", [out, marks]);
  return out;
}
