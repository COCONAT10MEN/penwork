import {
  PDFArray,
  PDFDict,
  PDFName,
  PDFRawStream,
  PDFRef,
  PDFStream,
  type PDFDocument,
  type PDFObject,
  type PDFPage,
} from "pdf-lib";

/** Reading and writing what a page draws, below what pdf-lib's drawing calls can do. */

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A stream's bytes with its filter undone; null for filters only a viewer needs to undo. */
export async function streamBytes(stream: PDFObject | undefined): Promise<Uint8Array | null> {
  if (!(stream instanceof PDFRawStream)) return null;
  const filter = stream.dict.get(PDFName.of("Filter"));
  const names =
    filter instanceof PDFName
      ? [filter.asString()]
      : filter instanceof PDFArray
        ? filter.asArray().map((f) => (f instanceof PDFName ? f.asString() : "?"))
        : [];
  if (names.length === 0) return stream.contents;
  if (
    names.length === 1 &&
    names[0] === "/FlateDecode" &&
    !stream.dict.has(PDFName.of("DecodeParms"))
  )
    return inflate(stream.contents);
  return null;
}

export const latin1 = (bytes: Uint8Array): string => {
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return out;
};

export const fromLatin1 = (text: string): Uint8Array => {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
};

export function contentRefs(page: PDFPage): PDFRef[] {
  const contents = page.node.get(PDFName.of("Contents"));
  if (contents instanceof PDFRef) return [contents];
  if (contents instanceof PDFArray)
    return contents.asArray().filter((c): c is PDFRef => c instanceof PDFRef);
  return [];
}

/** All of a page's content as one text, or null if part of it can't be read here. */
export async function pageContent(doc: PDFDocument, page: PDFPage): Promise<string | null> {
  const parts: string[] = [];
  for (const ref of contentRefs(page)) {
    const bytes = await streamBytes(doc.context.lookup(ref));
    if (!bytes) return null;
    parts.push(latin1(bytes));
  }
  return parts.join("\n");
}

export function setPageContent(doc: PDFDocument, page: PDFPage, text: string): void {
  const ref = doc.context.register(doc.context.flateStream(fromLatin1(text)));
  page.node.set(PDFName.of("Contents"), ref);
}

/**
 * Draws after the page's own content, in a clean graphics state: a page may leave its drawing
 * state changed at the end, which would move or recolour whatever is drawn after it.
 */
export function drawOnTop(doc: PDFDocument, page: PDFPage, ops: string): void {
  const start = doc.context.register(doc.context.flateStream(fromLatin1("q\n")));
  const end = doc.context.register(doc.context.flateStream(fromLatin1(`\nQ\n${ops}\n`)));
  if (!page.node.wrapContentStreams(start, end)) {
    page.node.set(PDFName.of("Contents"), doc.context.obj([start, end]));
  }
}

const DELIM = new Set(["(", ")", "<", ">", "[", "]", "{", "}", "/", "%"]);
const WHITE = new Set([" ", "\n", "\r", "\t", "\f", "\0"]);

/** One marked section: where its BDC/BMC starts (with its operands) and its EMC ends. */
export interface Marked {
  tag: string;
  /** The property list as written, or the name of one in the page's resources. */
  props: string;
  start: number;
  end: number;
}

type Operand = { text: string; start: number };

/**
 * Finds every marked-content section in content text. Strings, hex strings, dictionaries and inline
 * images are stepped over whole, so a ")" or "EMC" inside them is never taken for an operator.
 */
export function markedSections(text: string): Marked[] {
  const out: Marked[] = [];
  const open: { tag: string; props: string; start: number }[] = [];
  let operands: Operand[] = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i] ?? "";

    if (WHITE.has(c)) {
      i++;
      continue;
    }
    const start = i;
    if (c === "%") {
      while (i < n && text[i] !== "\n" && text[i] !== "\r") i++;
      continue;
    }
    if (c === "(") {
      let depth = 0;
      for (; i < n; i++) {
        if (text[i] === "\\") i++;
        else if (text[i] === "(") depth++;
        else if (text[i] === ")" && --depth === 0) break;
      }
      i++;
    } else if (c === "<" && text[i + 1] === "<") {
      let depth = 0;
      for (; i < n; i++) {
        if (text[i] === "(") {
          // a string inside a dictionary
          let d = 0;
          for (; i < n; i++) {
            if (text[i] === "\\") i++;
            else if (text[i] === "(") d++;
            else if (text[i] === ")" && --d === 0) break;
          }
        } else if (text[i] === "<" && text[i + 1] === "<") {
          depth++;
          i++;
        } else if (text[i] === "<") {
          // a hex string, whose closing ">" must not be read as half of ">>"
          while (i < n && text[i] !== ">") i++;
        } else if (text[i] === ">" && text[i + 1] === ">") {
          depth--;
          i++;
          if (depth === 0) break;
        }
      }
      i++;
    } else if (c === "<") {
      while (i < n && text[i] !== ">") i++;
      i++;
    } else if (c === "[" || c === "]" || c === "{" || c === "}") {
      i++;
    } else if (c === "/") {
      i++;
      while (i < n && !WHITE.has(text[i] ?? " ") && !DELIM.has(text[i] ?? " ")) i++;
    } else {
      while (i < n && !WHITE.has(text[i] ?? " ") && !DELIM.has(text[i] ?? " ")) i++;
      if (i === start) i++;
    }
    const token = text.slice(start, i);
    const isOperator =
      /^[A-Za-z'"*]+$/.test(token) && token !== "true" && token !== "false" && token !== "null";
    if (!isOperator) {
      operands.push({ text: token, start });
      continue;
    }
    if (token === "BI") {
      // An inline image: its data is raw bytes up to "EI" standing alone.
      const at = text.slice(i).search(/\sEI(\s|$)/);
      i = at < 0 ? n : i + at + 3;
    } else if (token === "BDC" && operands.length >= 2) {
      const [tag, props] = operands.slice(-2) as [Operand, Operand];
      open.push({ tag: tag.text, props: props.text, start: tag.start });
    } else if (token === "BMC" && operands.length >= 1) {
      const [tag] = operands.slice(-1) as [Operand];
      open.push({ tag: tag.text, props: "", start: tag.start });
    } else if (token === "EMC") {
      const section = open.pop();
      if (section) out.push({ ...section, end: i });
    }
    operands = [];
  }
  return out;
}

/** Cuts the given sections out, outermost first, so nested ones go with them. */
export function cutSections(text: string, sections: Marked[]): string {
  const sorted = [...sections].sort((a, b) => a.start - b.start || b.end - a.end);
  let out = "";
  let at = 0;
  for (const s of sorted) {
    if (s.start < at) continue;
    out += text.slice(at, s.start);
    at = s.end;
  }
  return out + text.slice(at);
}

/** Drops objects nothing points to any more, which removing pages or pictures leaves behind. */
export function prune(doc: PDFDocument): number {
  const seen = new Set<string>();
  const stack: PDFObject[] = [];
  const { Root, Info, Encrypt } = doc.context.trailerInfo;
  for (const start of [Root, Info, Encrypt]) if (start) stack.push(start);
  while (stack.length) {
    const obj = stack.pop();
    if (obj instanceof PDFRef) {
      const key = obj.toString();
      if (seen.has(key)) continue;
      seen.add(key);
      const target = doc.context.lookup(obj);
      if (target) stack.push(target);
    } else if (obj instanceof PDFDict) {
      for (const [, value] of obj.entries()) stack.push(value);
    } else if (obj instanceof PDFArray) {
      stack.push(...obj.asArray());
    } else if (obj instanceof PDFStream) {
      stack.push(obj.dict);
    }
  }
  let removed = 0;
  for (const [ref] of doc.context.enumerateIndirectObjects()) {
    if (!seen.has(ref.toString())) {
      doc.context.delete(ref);
      removed++;
    }
  }
  return removed;
}
