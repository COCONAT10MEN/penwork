/**
 * Letter-spaced words read back as words. Text set with wide letter spacing ("P H Y S I C S") comes
 * out of pdf.js with a space after every letter, and the real gaps between words are lost, so
 * "PHYSICS • 3RD SECONDARY" can't be told from "PHYSICS•3RDSECONDARY". Where each letter is drawn
 * says which: the gaps between letters are all about the same, and a word gap is wider. The same
 * positions show where pdf.js joined words that had something else drawn between them.
 */

/** One letter where it's drawn, in points from the page's top-left. */
export interface Glyph {
  ch: string;
  x: number;
  /** Baseline. */
  y: number;
  /** Where the letter's own width ends, before any letter spacing. */
  right: number;
  /** A space drawn as a letter: a word gap for sure. */
  space: boolean;
}

type M = [number, number, number, number, number, number];
const mul = (m: M, n: M): M => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const matrix = (a: unknown): M => {
  const v = Array.isArray(a) || ArrayBuffer.isView(a) ? Array.from(a as ArrayLike<number>) : [];
  return [v[0] ?? 1, v[1] ?? 0, v[2] ?? 0, v[3] ?? 1, v[4] ?? 0, v[5] ?? 0];
};

/** What pdf.js puts in a show-text instruction: letters, and numbers that move the next one. */
interface PdfGlyph {
  unicode?: string;
  width?: number;
  isSpace?: boolean;
}

/**
 * Every letter on the page where it's drawn, from pdf.js's list of drawing instructions, sorted by
 * baseline. `toView` turns the PDF's points (from the bottom-left) into the page's (from the
 * top-left).
 */
export function glyphsOf(
  fnArray: ArrayLike<number>,
  argsArray: ArrayLike<unknown>,
  OPS: Record<string, number>,
  toView: (x: number, y: number) => number[],
): Glyph[] {
  const out: Glyph[] = [];
  let ctm: M = [1, 0, 0, 1, 0, 0];
  const stack: {
    ctm: M;
    size: number;
    cs: number;
    ws: number;
    hs: number;
    rise: number;
    lead: number;
  }[] = [];
  let tm: M = [1, 0, 0, 1, 0, 0];
  let tlm: M = tm;
  let size = 0;
  let cs = 0;
  let ws = 0;
  let hs = 1;
  let rise = 0;
  let lead = 0;
  const moveLine = (x: number, y: number) => {
    tlm = mul(tlm, [1, 0, 0, 1, x, y]);
    tm = tlm;
  };
  const show = (items: unknown) => {
    if (!Array.isArray(items)) return;
    for (const g of items as (PdfGlyph | number | null)[]) {
      if (typeof g === "number") {
        tm = mul(tm, [1, 0, 0, 1, (-g / 1000) * size * hs, 0]);
        continue;
      }
      if (!g) continue;
      const w = ((g.width ?? 0) / 1000) * size;
      const at = mul(ctm, mul(tm, [1, 0, 0, 1, 0, rise]));
      const end = mul(ctm, mul(tm, [1, 0, 0, 1, w * hs, rise]));
      const [x = 0, y = 0] = toView(at[4], at[5]);
      const [right = 0] = toView(end[4], end[5]);
      const space = !!g.isSpace || g.unicode === " ";
      if (g.unicode) out.push({ ch: g.unicode, x, y, right, space });
      tm = mul(tm, [1, 0, 0, 1, (w + cs + (space ? ws : 0)) * hs, 0]);
    }
  };
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i];
    const args = (argsArray[i] ?? []) as unknown[];
    if (fn === OPS.save) stack.push({ ctm, size, cs, ws, hs, rise, lead });
    else if (fn === OPS.restore) {
      const s = stack.pop();
      if (s) ({ ctm, size, cs, ws, hs, rise, lead } = s);
    } else if (fn === OPS.transform) ctm = mul(ctm, matrix(args));
    else if (fn === OPS.paintFormXObjectBegin) {
      stack.push({ ctm, size, cs, ws, hs, rise, lead });
      if (args[0]) ctm = mul(ctm, matrix(args[0]));
    } else if (fn === OPS.paintFormXObjectEnd) {
      const s = stack.pop();
      if (s) ({ ctm, size, cs, ws, hs, rise, lead } = s);
    } else if (fn === OPS.beginText) tm = tlm = [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.setTextMatrix) {
      const v = Array.isArray(args[0]) || ArrayBuffer.isView(args[0]) ? args[0] : args;
      tm = tlm = matrix(v);
    } else if (fn === OPS.moveText) moveLine(Number(args[0]) || 0, Number(args[1]) || 0);
    else if (fn === OPS.setLeadingMoveText) {
      lead = -(Number(args[1]) || 0);
      moveLine(Number(args[0]) || 0, Number(args[1]) || 0);
    } else if (fn === OPS.nextLine) moveLine(0, -lead);
    else if (fn === OPS.setFont) size = Number(args[1]) || 0;
    else if (fn === OPS.setCharSpacing) cs = Number(args[0]) || 0;
    else if (fn === OPS.setWordSpacing) ws = Number(args[0]) || 0;
    else if (fn === OPS.setHScale) hs = (Number(args[0]) || 100) / 100;
    else if (fn === OPS.setTextRise) rise = Number(args[0]) || 0;
    else if (fn === OPS.setLeading) lead = Number(args[0]) || 0;
    else if (fn === OPS.showText || fn === OPS.showSpacedText) show(args[0]);
    else if (fn === OPS.nextLineShowText) {
      moveLine(0, -lead);
      show(args[0]);
    } else if (fn === OPS.nextLineSetSpacingShowText) {
      ws = Number(args[0]) || 0;
      cs = Number(args[1]) || 0;
      moveLine(0, -lead);
      show(args[2]);
    }
  }
  // By baseline, so a line's letters are found without going through the whole page.
  return out.sort((a, b) => a.y - b.y);
}

interface Placed {
  text: string;
  x: number;
  y: number;
  width: number;
  size: number;
}

/** The first of the glyphs (sorted by baseline) at or below `y`. */
function firstAt(glyphs: Glyph[], y: number) {
  let lo = 0;
  let hi = glyphs.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((glyphs[mid] as Glyph).y < y) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * The letters drawn where a piece of text is, left to right, each once (a text shadow is the same
 * letters drawn again a hair away); null when they aren't the piece's letters.
 */
function lettersOf(piece: Placed, glyphs: Glyph[]): Glyph[] | null {
  const near: Glyph[] = [];
  for (let i = firstAt(glyphs, piece.y - piece.size * 0.3); i < glyphs.length; i++) {
    const g = glyphs[i] as Glyph;
    if (g.y > piece.y + piece.size * 0.3) break;
    if (g.x > piece.x - piece.size * 0.3 && g.x < piece.x + piece.width) near.push(g);
  }
  near.sort((a, b) => a.x - b.x);
  const letters: Glyph[] = [];
  for (const g of near) {
    const last = letters[letters.length - 1];
    if (last && last.ch === g.ch && Math.abs(last.x - g.x) < piece.size * 0.25) continue;
    letters.push(g);
  }
  const drawn = letters.filter((g) => !g.space);
  const same = drawn.map((g) => g.ch).join("") === piece.text.replace(/\s+/g, "");
  return drawn.length >= 2 && same ? letters : null;
}

/** A part of a piece of text: its words, where its letters start, and how wide they are. */
export interface Part {
  text: string;
  x: number;
  width: number;
}

/**
 * A piece of text cut where something else is drawn inside it. pdf.js reads "1 : √2 : 0", with the
 * root sign drawn as a shape, as one piece "1 : 2 : 0" with a single space where the sign is; the
 * parts can each be put back where they were. Null when nothing in it is that far apart. The
 * parts' text, end to end, is the piece's.
 */
export function splitAtGaps(piece: Placed, glyphs: Glyph[]): Part[] | null {
  if (!/\S\s*\S/.test(piece.text)) return null;
  const letters = lettersOf(piece, glyphs);
  if (!letters) return null;
  const drawn = letters.filter((g) => !g.space);
  // Where each drawn letter is in the text.
  const at: number[] = [];
  let i = 0;
  for (const g of drawn) {
    while (i < piece.text.length && /\s/.test(piece.text[i] as string)) i++;
    at.push(i);
    i += g.ch.length;
  }
  const parts: Part[] = [];
  let from = 0;
  let first = 0;
  const close = (end: number, last: number) => {
    const a = drawn[first] as Glyph;
    const b = drawn[last] as Glyph;
    parts.push({ text: piece.text.slice(from, end), x: a.x, width: b.right - a.x });
  };
  for (let k = 1; k < drawn.length; k++) {
    const a = drawn[k - 1] as Glyph;
    const b = drawn[k] as Glyph;
    if (b.x - a.right <= piece.size * 0.6) continue;
    const end = (at[k - 1] as number) + a.ch.length;
    close(end, k - 1);
    from = end;
    first = k;
  }
  if (!parts.length) return null;
  close(piece.text.length, drawn.length - 1);
  return parts;
}

/** pdf.js's reading of letter-spaced text: most "words" one letter long. */
export function looksLetterSpaced(text: string) {
  const words = text.trim().split(/ +/);
  return words.length >= 4 && words.filter((w) => w.length === 1).length >= words.length * 0.75;
}

/**
 * The words of a letter-spaced piece of text, with spaces only where the letters have a word gap
 * between them; null where the letters drawn there don't match it (it stays as pdf.js read it).
 */
export function respace(piece: Placed, glyphs: Glyph[]): string | null {
  const letters = lettersOf(piece, glyphs);
  if (!letters) return null;
  const gaps: number[] = [];
  for (let i = 1; i < letters.length; i++) {
    const a = letters[i - 1] as Glyph;
    const b = letters[i] as Glyph;
    if (!a.space && !b.space) gaps.push(b.x - a.right);
  }
  const typical = [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length / 2)] ?? 0;
  // Letters a whole space apart already are words with spaces between: leave them be.
  if (typical > piece.size * 0.22) return null;
  const wide = Math.max(typical * 1.6, typical + piece.size * 0.15);
  let text = "";
  for (let i = 0; i < letters.length; i++) {
    const g = letters[i] as Glyph;
    const prev = letters[i - 1];
    if (g.space) {
      if (!text.endsWith(" ")) text += " ";
      continue;
    }
    if (prev && !prev.space && g.x - prev.right > wide && !text.endsWith(" ")) text += " ";
    text += g.ch;
  }
  return text.trim();
}
