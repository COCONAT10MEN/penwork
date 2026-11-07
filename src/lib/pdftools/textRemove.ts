import { Encodings, Font as StandardFont } from "@pdf-lib/standard-fonts";
import {
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFRef,
  type PDFDocument,
  type PDFObject,
  type PDFPage,
} from "pdf-lib";
import { pageContent, setPageContent } from "./content";
import { load, save } from "./pages";

/**
 * Takes words out of a page for good, as Acrobat's text editing does: the page's drawing is read
 * letter by letter (where each lands, from the font's widths and the text position settings), and
 * the letters inside the given areas are taken out of what the page draws. What came after them
 * stays exactly where it was, the gap kept by a spacing number. Fonts that can't be measured here,
 * and text inside form XObjects, are left as they are; the caller paints over those instead.
 */

export interface Region {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

type M = [number, number, number, number, number, number];
const mul = (m: M, n: M): M => [
  m[0] * n[0] + m[1] * n[2],
  m[0] * n[1] + m[1] * n[3],
  m[2] * n[0] + m[3] * n[2],
  m[2] * n[1] + m[3] * n[3],
  m[4] * n[0] + m[5] * n[2] + n[4],
  m[4] * n[1] + m[5] * n[3] + n[5],
];
const apply = (m: M, x: number, y: number) => [
  m[0] * x + m[2] * y + m[4],
  m[1] * x + m[3] * y + m[5],
];

/* ---------- Reading the content: tokens with where they are ---------- */

type Token =
  | { kind: "num"; value: number }
  | { kind: "str"; bytes: number[] }
  | { kind: "name"; value: string }
  | { kind: "arr"; items: Token[] }
  | { kind: "other"; value: string };

interface Op {
  name: string;
  args: Token[];
  start: number;
  end: number;
}

const WHITE = /[\s\0]/;
const DELIM = /[()<>[\]{}/%]/;

function readString(s: string, i: number): [number[], number] {
  // A literal string from just after "(": escapes, and nested brackets kept.
  const out: number[] = [];
  let depth = 1;
  while (i < s.length) {
    const c = s[i++] as string;
    if (c === "\\") {
      const n = s[i++] as string;
      const map: Record<string, number> = {
        n: 10,
        r: 13,
        t: 9,
        b: 8,
        f: 12,
        "(": 40,
        ")": 41,
        "\\": 92,
      };
      if (n in map) out.push(map[n] as number);
      else if (/[0-7]/.test(n)) {
        let oct = n;
        while (oct.length < 3 && /[0-7]/.test(s[i] ?? "")) oct += s[i++];
        out.push(parseInt(oct, 8) & 255);
      } else if (n === "\r") {
        if (s[i] === "\n") i++;
      } else if (n !== "\n") out.push(n.charCodeAt(0));
    } else if (c === "(") {
      depth++;
      out.push(40);
    } else if (c === ")") {
      if (--depth === 0) break;
      out.push(41);
    } else out.push(c.charCodeAt(0) & 255);
  }
  return [out, i];
}

function parse(s: string): Op[] {
  const ops: Op[] = [];
  let args: Token[] = [];
  let opStart = -1;
  const stack: Token[][] = [];
  let i = 0;
  const push = (t: Token, at: number) => {
    if (opStart < 0) opStart = at;
    const top = stack[stack.length - 1];
    if (top) top.push(t);
    else args.push(t);
  };
  while (i < s.length) {
    const c = s[i] as string;
    if (WHITE.test(c)) {
      i++;
      continue;
    }
    const at = i;
    if (c === "%") {
      while (i < s.length && s[i] !== "\n" && s[i] !== "\r") i++;
    } else if (c === "(") {
      const [bytes, next] = readString(s, i + 1);
      push({ kind: "str", bytes }, at);
      i = next;
    } else if (c === "<" && s[i + 1] === "<") {
      // A dictionary (in BDC, inline images): kept as text, read to its matching end.
      let depth = 0;
      while (i < s.length) {
        if (s[i] === "<" && s[i + 1] === "<") {
          depth++;
          i += 2;
        } else if (s[i] === ">" && s[i + 1] === ">") {
          depth--;
          i += 2;
          if (depth === 0) break;
        } else if (s[i] === "(") i = readString(s, i + 1)[1];
        else i++;
      }
      push({ kind: "other", value: s.slice(at, i) }, at);
    } else if (c === "<") {
      const close = s.indexOf(">", i);
      const hex = s.slice(i + 1, close).replace(/\s/g, "");
      const bytes: number[] = [];
      for (let k = 0; k < hex.length; k += 2)
        bytes.push(parseInt((hex[k] ?? "0") + (hex[k + 1] ?? "0"), 16));
      push({ kind: "str", bytes }, at);
      i = close + 1;
    } else if (c === "[") {
      stack.push([]);
      if (opStart < 0) opStart = at;
      i++;
    } else if (c === "]") {
      const items = stack.pop() ?? [];
      i++;
      push({ kind: "arr", items }, at);
    } else if (c === "/") {
      i++;
      while (i < s.length && !WHITE.test(s[i] as string) && !DELIM.test(s[i] as string)) i++;
      push({ kind: "name", value: s.slice(at + 1, i) }, at);
    } else {
      while (i < s.length && !WHITE.test(s[i] as string) && !DELIM.test(s[i] as string)) i++;
      const word = s.slice(at, i);
      if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(word)) push({ kind: "num", value: Number(word) }, at);
      else if (word === "true" || word === "false" || word === "null")
        push({ kind: "other", value: word }, at);
      else {
        if (opStart < 0) opStart = at;
        ops.push({ name: word, args, start: opStart, end: i });
        args = [];
        opStart = -1;
        if (word === "BI") {
          // An inline image: its data is binary, so skip to the EI that ends it.
          const ei = findEI(s, i);
          const last = ops[ops.length - 1] as Op;
          last.end = ei;
          i = ei;
        }
      }
    }
  }
  return ops;
}

function findEI(s: string, from: number): number {
  const re = /\sEI(?=[\s\0]|$)/g;
  re.lastIndex = from;
  const m = re.exec(s);
  return m ? m.index + m[0].length : s.length;
}

/* ---------- Fonts: how wide each code is ---------- */

interface Metrics {
  /** Bytes a code takes: 1 for simple fonts, 2 for Identity-H. */
  bytes: 1 | 2;
  /** A code's advance in text space units (a thousandth of the size, for most fonts). */
  advance: (code: number) => number;
}

const STANDARD = new Set([
  "Courier",
  "Courier-Bold",
  "Courier-Oblique",
  "Courier-BoldOblique",
  "Helvetica",
  "Helvetica-Bold",
  "Helvetica-Oblique",
  "Helvetica-BoldOblique",
  "Times-Roman",
  "Times-Bold",
  "Times-Italic",
  "Times-BoldItalic",
  "Symbol",
  "ZapfDingbats",
]);
const ALIAS: Record<string, string> = {
  Arial: "Helvetica",
  "Arial,Bold": "Helvetica-Bold",
  "Arial,Italic": "Helvetica-Oblique",
  "Arial,BoldItalic": "Helvetica-BoldOblique",
  TimesNewRoman: "Times-Roman",
  CourierNew: "Courier",
};

const num = (o: PDFObject | undefined) => (o instanceof PDFNumber ? o.asNumber() : undefined);

function metricsOf(doc: PDFDocument, font: PDFDict): Metrics | null {
  const subtype = font.get(PDFName.of("Subtype"))?.toString();
  if (subtype === "/Type0") {
    const enc = font.get(PDFName.of("Encoding"))?.toString();
    if (enc !== "/Identity-H") return null;
    const kids = font.lookup(PDFName.of("DescendantFonts"), PDFArray);
    const cid = kids?.lookup(0, PDFDict);
    if (!cid) return null;
    const dw = num(cid.get(PDFName.of("DW"))) ?? 1000;
    const widths = new Map<number, number>();
    const w = cid.lookup(PDFName.of("W"));
    if (w instanceof PDFArray) {
      const a = w.asArray().map((x) => (x instanceof PDFRef ? doc.context.lookup(x) : x));
      for (let i = 0; i < a.length;) {
        const first = num(a[i]);
        const next = a[i + 1];
        if (first === undefined) break;
        if (next instanceof PDFArray) {
          next.asArray().forEach((v, k) => widths.set(first + k, num(v) ?? dw));
          i += 2;
        } else {
          const last = num(next) ?? first;
          const v = num(a[i + 2]) ?? dw;
          for (let c = first; c <= last; c++) widths.set(c, v);
          i += 3;
        }
      }
    }
    return { bytes: 2, advance: (c) => (widths.get(c) ?? dw) / 1000 };
  }
  // Type 3: widths in glyph space, scaled by the font's own matrix.
  const scale =
    subtype === "/Type3"
      ? (num(font.lookup(PDFName.of("FontMatrix"), PDFArray)?.get(0)) ?? 0.001)
      : 0.001;
  const widths = font.lookup(PDFName.of("Widths"));
  if (widths instanceof PDFArray) {
    const first = num(font.get(PDFName.of("FirstChar"))) ?? 0;
    const missing =
      num(font.lookup(PDFName.of("FontDescriptor"), PDFDict)?.get(PDFName.of("MissingWidth"))) ?? 0;
    const list = widths.asArray().map((x) => num(x instanceof PDFRef ? doc.context.lookup(x) : x));
    return { bytes: 1, advance: (c) => (list[c - first] ?? missing) * scale };
  }
  // The 14 built-in fonts carry no widths: they come with pdf-lib.
  const base =
    font
      .get(PDFName.of("BaseFont"))
      ?.toString()
      .slice(1)
      .replace(/^[A-Z]{6}\+/, "") ?? "";
  const std = STANDARD.has(base) ? base : ALIAS[base];
  if (!std) return null;
  const metrics = StandardFont.load(std as never);
  const encoding =
    std === "Symbol"
      ? Encodings.Symbol
      : std === "ZapfDingbats"
        ? Encodings.ZapfDingbats
        : Encodings.WinAnsi;
  const names = new Map<number, string>();
  for (const cp of encoding.supportedCodePoints) {
    const { code, name } = encoding.encodeUnicodeCodePoint(cp);
    if (!names.has(code)) names.set(code, name);
  }
  // Differences in the font's own encoding win.
  const diffs = font.lookup(PDFName.of("Encoding"));
  if (diffs instanceof PDFDict) {
    const d = diffs.lookup(PDFName.of("Differences"));
    if (d instanceof PDFArray) {
      let code = 0;
      for (const x of d.asArray()) {
        if (x instanceof PDFNumber) code = x.asNumber();
        else if (x instanceof PDFName) names.set(code++, x.asString().slice(1));
      }
    }
  }
  return {
    bytes: 1,
    advance: (c) => (Number(metrics.getWidthOfGlyph(names.get(c) ?? "space") ?? 0) || 0) / 1000,
  };
}

/* ---------- Walking the page's text ---------- */

const hexOf = (codes: number[], bytes: 1 | 2) =>
  `<${codes.map((c) => c.toString(16).padStart(bytes * 2, "0")).join("")}>`;

/**
 * The page's content with the letters in `areas` taken out, and which areas had any taken out.
 * `fonts` are the page's fonts by resource name.
 */
export function stripText(
  content: string,
  fonts: Map<string, Metrics>,
  areas: { x0: number; y0: number; x1: number; y1: number }[],
): { content: string; hit: boolean[] } {
  const hit = areas.map(() => false);
  const ops = parse(content);
  let ctm: M = [1, 0, 0, 1, 0, 0];
  const stack: M[] = [];
  let tm: M = [1, 0, 0, 1, 0, 0];
  let tlm: M = [1, 0, 0, 1, 0, 0];
  let font: Metrics | null = null;
  let size = 0;
  let tc = 0;
  let tw = 0;
  let th = 1;
  let tl = 0;
  let rise = 0;
  const edits: { start: number; end: number; text: string }[] = [];
  const nextLine = () => {
    tlm = mul([1, 0, 0, 1, 0, -tl], tlm);
    tm = tlm;
  };
  const numArg = (op: Op, i: number) =>
    op.args[i]?.kind === "num" ? (op.args[i] as { value: number }).value : 0;

  /** Walks one string's glyphs, moving the text matrix; gives back which to take out. */
  const walk = (bytes: number[]) => {
    const out: { code: number; gone: boolean; advance: number }[] = [];
    if (!font) return out;
    const width = font.bytes;
    for (let i = 0; i + width - 1 < bytes.length; i += width) {
      const code = width === 2 ? ((bytes[i] ?? 0) << 8) | (bytes[i + 1] ?? 0) : (bytes[i] ?? 0);
      const w0 = font.advance(code);
      const space = width === 1 && code === 32 ? tw : 0;
      const advance = (w0 * size + tc + space) * th;
      // The glyph's middle, a third of the size up from the baseline, on the page.
      const trm = mul(mul([size * th, 0, 0, size, 0, rise], tm), ctm);
      const [cx, cy] = apply(trm, w0 / 2, 0.33) as [number, number];
      let gone = false;
      areas.forEach((a, k) => {
        if (cx >= a.x0 && cx <= a.x1 && cy >= a.y0 && cy <= a.y1 && w0 > 0) {
          gone = true;
          hit[k] = true;
        }
      });
      out.push({ code, gone, advance: w0 * 1000 + ((tc + space) * 1000) / (size || 1) });
      tm = mul([1, 0, 0, 1, advance, 0], tm);
    }
    return out;
  };

  /** A string or a TJ array, rewritten when any of its glyphs went; null when nothing did. */
  const showRewritten = (items: Token[]): string | null => {
    if (!font) return null;
    const bytes = font.bytes;
    const parts: string[] = [];
    let any = false;
    let run: number[] = [];
    const flush = () => {
      if (run.length) parts.push(hexOf(run, bytes));
      run = [];
    };
    for (const item of items) {
      if (item.kind === "num") {
        flush();
        parts.push(String(item.value));
        tm = mul([1, 0, 0, 1, (-item.value / 1000) * size * th, 0], tm);
      } else if (item.kind === "str") {
        for (const g of walk(item.bytes)) {
          if (g.gone) {
            any = true;
            flush();
            // The gap the letter left, kept: what follows stays where it was.
            parts.push((-g.advance).toFixed(3));
          } else run.push(g.code);
        }
        flush();
      }
    }
    return any ? `[${parts.join(" ")}] TJ` : null;
  };

  for (const op of ops) {
    switch (op.name) {
      case "q":
        stack.push(ctm);
        break;
      case "Q":
        ctm = stack.pop() ?? ctm;
        break;
      case "cm":
        ctm = mul(op.args.map((_, i) => numArg(op, i)) as unknown as M, ctm);
        break;
      case "BT":
        tm = [1, 0, 0, 1, 0, 0];
        tlm = tm;
        break;
      case "Tm":
        tm = op.args.slice(0, 6).map((_, i) => numArg(op, i)) as unknown as M;
        tlm = tm;
        break;
      case "Td":
        tlm = mul([1, 0, 0, 1, numArg(op, 0), numArg(op, 1)], tlm);
        tm = tlm;
        break;
      case "TD":
        tl = -numArg(op, 1);
        tlm = mul([1, 0, 0, 1, numArg(op, 0), numArg(op, 1)], tlm);
        tm = tlm;
        break;
      case "T*":
        nextLine();
        break;
      case "TL":
        tl = numArg(op, 0);
        break;
      case "Tc":
        tc = numArg(op, 0);
        break;
      case "Tw":
        tw = numArg(op, 0);
        break;
      case "Tz":
        th = numArg(op, 0) / 100;
        break;
      case "Ts":
        rise = numArg(op, 0);
        break;
      case "Tf": {
        const name = op.args[0]?.kind === "name" ? op.args[0].value : "";
        font = fonts.get(name) ?? null;
        size = numArg(op, 1);
        break;
      }
      case "Tj":
      case "'":
      case '"':
      case "TJ": {
        if (op.name === "'") nextLine();
        if (op.name === '"') {
          tw = numArg(op, 0);
          tc = numArg(op, 1);
          nextLine();
        }
        const shown = op.args[op.args.length - 1];
        const items = shown?.kind === "arr" ? shown.items : shown ? [shown] : [];
        const prefix = op.name === "'" ? "T* " : op.name === '"' ? `${tw} Tw ${tc} Tc T* ` : "";
        const rewritten = showRewritten(items);
        if (rewritten) edits.push({ start: op.start, end: op.end, text: prefix + rewritten });
        break;
      }
    }
  }
  let out = content;
  for (const e of edits.sort((a, b) => b.start - a.start))
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return { content: out, hit };
}

/** The page's fonts, by the names its content uses, that can be measured here. */
function fontsOf(doc: PDFDocument, page: PDFPage): Map<string, Metrics> {
  const out = new Map<string, Metrics>();
  const fonts = page.node.normalizedEntries().Resources.lookup(PDFName.of("Font"));
  if (!(fonts instanceof PDFDict)) return out;
  for (const key of fonts.keys()) {
    const dict = fonts.lookup(key);
    if (!(dict instanceof PDFDict)) continue;
    const m = metricsOf(doc, dict);
    if (m) out.set(key.asString().slice(1), m);
  }
  return out;
}

/**
 * The file with the words inside `regions` taken out of its pages. `removed` says, for each
 * region, whether any letters were found and taken out there.
 */
export async function removeText(
  bytes: Uint8Array,
  regions: Region[],
): Promise<{ bytes: Uint8Array; removed: boolean[] }> {
  const removed = regions.map(() => false);
  if (!regions.length) return { bytes, removed };
  const doc = await load(bytes);
  const pages = doc.getPages();
  let changed = false;
  for (const n of new Set(regions.map((r) => r.page))) {
    const page = pages[n - 1];
    if (!page) continue;
    const content = await pageContent(doc, page);
    if (content === null) continue;
    const mine = regions.map((r, i) => ({ r, i })).filter((x) => x.r.page === n);
    const result = stripText(
      content,
      fontsOf(doc, page),
      mine.map(({ r }) => ({
        x0: r.x - 0.5,
        y0: r.y - 0.5,
        x1: r.x + r.width + 0.5,
        y1: r.y + r.height + 0.5,
      })),
    );
    result.hit.forEach((h, k) => {
      if (h) removed[(mine[k] as { i: number }).i] = true;
    });
    if (result.content !== content) {
      setPageContent(doc, page, result.content);
      changed = true;
    }
  }
  return { bytes: changed ? await save(doc) : bytes, removed };
}
