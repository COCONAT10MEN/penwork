import type { PDFDocumentProxy } from "pdfjs-dist";
import type { Block, PageLayout, Run } from "../../lib/pdftools/pageLayout";
import { cellOf } from "../../lib/pdftools/textLayout";
import { readPage } from "./pageRead";
import { pageText, renderPage } from "./pdfRead";

export { toWord } from "./wordExport";

/**
 * PDF to Word (wordExport.ts), Excel, PowerPoint, pictures, text and Markdown, all from the page's
 * layout read back (pageLayout.ts). Each library is loaded only when its tool runs, so none of them
 * slows opening a PDF.
 */

type Progress = (done: number, total: number) => void;
type Out = { name: string; bytes: Uint8Array }[];

const pagesOf = (doc: PDFDocumentProxy) => Array.from({ length: doc.numPages }, (_, i) => i + 1);

const plain = (runs: Run[]) =>
  runs
    .map((r) => r.text)
    .join("")
    .trim();

/**
 * Each page as a sheet: its tables as rows and columns, numbers as numbers and the header row in
 * bold; the text around them as rows of their own, headings in bold.
 */
export async function toExcel(
  doc: PDFDocumentProxy,
  stem: string,
  progress: Progress,
): Promise<Out> {
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  for (const n of pagesOf(doc)) {
    progress(n - 1, doc.numPages);
    const { layout } = await readPage(doc, n, 1);
    const blocks = layout.blocks.filter((b) => b.kind !== "picture");
    if (!blocks.length) continue;
    const sheet = book.addWorksheet(`Page ${n}`);
    const widths: number[] = [];
    const note = (i: number, text: string) =>
      (widths[i] = Math.max(widths[i] ?? 8, Math.min(60, text.length + 2)));
    for (const b of blocks) {
      if (b.kind === "paragraph") {
        const text = plain(b.runs);
        const row = sheet.addRow([text]);
        if (b.heading || b.runs.every((r) => r.bold))
          row.font = { bold: true, size: b.heading ? 13 : 11 };
        // Long text runs across the cells beside it rather than widening the column.
        note(0, text.slice(0, 30));
      } else if (b.kind === "table") {
        b.rows.forEach((cells, i) => {
          const values = cells.map((c) => cellOf(plain(c)));
          const row = sheet.addRow(values.map((v) => v.value));
          values.forEach((v, j) => {
            note(j, plain(cells[j] ?? []));
            if (v.format) row.getCell(j + 1).numFmt = v.format;
          });
          if (i === 0 && cells.every((c) => !c.length || c.every((r) => r.bold)))
            row.font = { bold: true };
          row.eachCell((cell) => {
            cell.border = {
              top: { style: "thin", color: { argb: "FF8C8C8C" } },
              bottom: { style: "thin", color: { argb: "FF8C8C8C" } },
              left: { style: "thin", color: { argb: "FF8C8C8C" } },
              right: { style: "thin", color: { argb: "FF8C8C8C" } },
            };
          });
        });
      }
    }
    sheet.columns.forEach((col, i) => (col.width = widths[i] ?? 12));
  }
  if (book.worksheets.length === 0)
    book.addWorksheet("Page 1").addRow(["This PDF has no text. Run OCR on it first."]);
  progress(doc.numPages, doc.numPages);
  const data = await book.xlsx.writeBuffer();
  return [{ name: `${stem}.xlsx`, bytes: new Uint8Array(data as ArrayBuffer) }];
}

/** The most common colour around a box on a drawn page: what the text there sits on. */
function paperAround(canvas: HTMLCanvasElement, x: number, y: number, w: number, h: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return "#ffffff";
  const counts = new Map<number, number>();
  const strip = (sx: number, sy: number, sw: number, sh: number) => {
    const d = ctx.getImageData(
      Math.max(0, sx),
      Math.max(0, sy),
      Math.max(1, sw),
      Math.max(1, sh),
    ).data;
    for (let i = 0; i < d.length; i += 4) {
      const k = (((d[i] ?? 0) >> 3) << 10) | (((d[i + 1] ?? 0) >> 3) << 5) | ((d[i + 2] ?? 0) >> 3);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  };
  strip(x - 3, y - 3, w + 6, 2);
  strip(x - 3, y + h + 1, w + 6, 2);
  const k = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0x7fff;
  const c = [((k >> 10) & 31) * 8.226, ((k >> 5) & 31) * 8.226, (k & 31) * 8.226];
  return `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

/** The boxes text sits in on a page: each paragraph, and each table cell's row. */
function textBoxes(layout: PageLayout) {
  const out: {
    block: Block;
    x: number;
    y: number;
    w: number;
    h: number;
    runs: Run[];
    row?: number;
    col?: number;
  }[] = [];
  for (const b of layout.blocks) {
    if (b.kind === "paragraph")
      out.push({
        block: b,
        x: b.left,
        y: b.top,
        w: b.right - b.left,
        h: b.bottom - b.top,
        runs: b.runs,
      });
    else if (b.kind === "table")
      b.rows.forEach((cells, r) =>
        cells.forEach((cell, c) => {
          if (!cell.length) return;
          const x = b.columns[c] ?? b.left;
          const next = b.columns[c + 1] ?? b.right;
          const y = b.rowTops[r] ?? b.top;
          out.push({
            block: b,
            x,
            y,
            w: next - x,
            h: (b.rowBottoms[r] ?? y + 12) - y,
            runs: cell,
            row: r,
            col: c,
          });
        }),
      );
  }
  return out;
}

/**
 * Each page as a slide, its text editable: the page's drawing is the slide's background with the
 * text painted out in the colour around it, and the text sits on it in text boxes, in its own font,
 * size and colour, where it was. A scanned page stays a picture.
 */
export async function toPowerPoint(
  doc: PDFDocumentProxy,
  stem: string,
  progress: Progress,
): Promise<Out> {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const deck = new PptxGenJS();
  const first = (await doc.getPage(1)).getViewport({ scale: 1 });
  const w = first.width / 72;
  const h = first.height / 72;
  deck.defineLayout({ name: "PDF", width: w, height: h });
  deck.layout = "PDF";
  const inch = (pt: number) => pt / 72;
  for (const n of pagesOf(doc)) {
    progress(n - 1, doc.numPages);
    const read = await readPage(doc, n, 2);
    const { layout, canvas, scale } = read;
    const boxes = read.scanned ? [] : textBoxes(layout);
    const ctx = canvas.getContext("2d");
    for (const b of boxes) {
      if (!ctx) break;
      const x = (b.x - 1.5) * scale;
      const y = (b.y - 2) * scale;
      const bw = (b.w + 3) * scale;
      const bh = (b.h + 4) * scale;
      ctx.fillStyle = paperAround(canvas, x, y, bw, bh);
      ctx.fillRect(x, y, bw, bh);
    }
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/jpeg", 0.88));
    if (!blob) continue;
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let b64 = "";
    for (let i = 0; i < bytes.length; i += 0x8000)
      b64 += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const slide = deck.addSlide();
    // A page of another shape than the first is fitted in the middle.
    const s = Math.min(w / inch(layout.width), h / inch(layout.height));
    const ox = (w - inch(layout.width) * s) / 2;
    const oy = (h - inch(layout.height) * s) / 2;
    slide.addImage({
      data: `data:image/jpeg;base64,${btoa(b64)}`,
      x: ox,
      y: oy,
      w: inch(layout.width) * s,
      h: inch(layout.height) * s,
    });
    for (const b of boxes) {
      const para = b.block.kind === "paragraph" ? b.block : null;
      slide.addText(
        b.runs.map((r) => ({
          text: r.text,
          options: {
            fontFace: r.font,
            fontSize: Math.max(1, Math.round(r.size * s * 2) / 2),
            bold: r.bold,
            italic: r.italic,
            color: r.color.slice(1),
          },
        })),
        {
          x: ox + inch(b.x) * s,
          y: oy + inch(b.y - 1) * s,
          // A little wider than the words, so a font drawn a touch wider doesn't wrap early.
          w: inch(b.w * 1.04 + 6) * s,
          h: inch(b.h + 4) * s,
          align: para?.align === "justify" ? "justify" : (para?.align ?? "left"),
          valign: "top",
          margin: 0,
          paraSpaceBefore: 0,
          ...(para?.lineHeight ? { lineSpacing: para.lineHeight * s } : {}),
          fit: "none",
          wrap: true,
        },
      );
    }
    if (boxes.length) slide.addNotes(boxes.map((b) => plain(b.runs)).join("\n"));
  }
  progress(doc.numPages, doc.numPages);
  const data = (await deck.write({ outputType: "uint8array" })) as Uint8Array;
  return [{ name: `${stem}.pptx`, bytes: data }];
}

/** Markdown from a page's layout: headings, lists, bold and italic words, and tables. */
export function layoutMarkdown(layout: PageLayout): string {
  const md = (runs: Run[]) =>
    runs
      .map((r) => {
        const t = r.text.replace(/([*_`|])/g, "\\$1");
        if (!t.trim()) return t;
        const lead = t.match(/^\s*/)?.[0] ?? "";
        const tail = t.match(/\s*$/)?.[0] ?? "";
        const core = t.trim();
        const mark = r.bold && r.italic ? "***" : r.bold ? "**" : r.italic ? "*" : "";
        return lead + mark + core + mark + tail;
      })
      .join("")
      .trim();
  const out: string[] = [];
  let n = 0;
  for (const b of layout.blocks) {
    if (b.kind === "picture") continue;
    if (b.kind === "table") {
      const rows = b.rows.map((cells) => cells.map((c) => plain(c).replace(/\|/g, "\\|")));
      const head = rows[0] ?? [];
      out.push(
        [
          `| ${head.join(" | ")} |`,
          `| ${head.map(() => "---").join(" | ")} |`,
          ...rows.slice(1).map((r) => `| ${r.join(" | ")} |`),
        ].join("\n"),
      );
      continue;
    }
    if (b.list !== "number") n = 0;
    const text = b.heading ? plain(b.runs) : md(b.runs);
    if (b.heading) out.push(`${"#".repeat(b.heading)} ${text}`);
    else if (b.list === "bullet") out.push(`- ${text.replace(/^[•·▪◦‣●○■□\-–*]\s*/, "")}`);
    else if (b.list === "number") out.push(`${++n}. ${text.replace(/^\(?\d{1,3}[.)]\s*/, "")}`);
    else out.push(text);
  }
  return out.join("\n\n");
}

export async function toPictures(
  doc: PDFDocumentProxy,
  stem: string,
  o: { type: "jpg" | "png"; dpi: number; pages: number[] },
  progress: Progress,
): Promise<Out> {
  const out: Out = [];
  const pad = String(doc.numPages).length;
  for (let i = 0; i < o.pages.length; i++) {
    progress(i, o.pages.length);
    const n = o.pages[i] ?? 1;
    const pic = await renderPage(doc, n, o.dpi / 72, o.type, 0.9);
    out.push({ name: `${stem} page ${String(n).padStart(pad, "0")}.${o.type}`, bytes: pic.bytes });
  }
  progress(o.pages.length, o.pages.length);
  return out;
}

export async function toText(
  doc: PDFDocumentProxy,
  stem: string,
  kind: "txt" | "md",
  progress: Progress,
): Promise<Out> {
  const parts: string[] = [];
  for (const n of pagesOf(doc)) {
    progress(n - 1, doc.numPages);
    if (kind === "md") parts.push(layoutMarkdown((await readPage(doc, n, 1)).layout));
    else parts.push((await pageText(doc, n)).lines.map((l) => l.text).join("\r\n"));
  }
  progress(doc.numPages, doc.numPages);
  const text = parts.join(kind === "md" ? "\n\n---\n\n" : "\r\n\f\r\n");
  // A byte-order mark, so Notepad reads Arabic and other scripts right.
  const bytes = new TextEncoder().encode((kind === "txt" ? "﻿" : "") + text);
  return [{ name: `${stem}.${kind}`, bytes }];
}
