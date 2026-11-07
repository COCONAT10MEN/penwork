import type { PDFDocumentProxy } from "pdfjs-dist";
import type { Block, PageLayout, ParagraphBlock, Line, Run } from "../../lib/pdftools/pageLayout";
import { readPage } from "./pageRead";
import { pageBoxes } from "./wordExact";
import { sideBySide, type SideBySide } from "../../lib/pdftools/sideBySide";
import { wordTable } from "./wordTable";
import { renderPage } from "./pdfRead";

/**
 * PDF to Word, as close to the page as Word allows: each PDF page is a Word page of the same size
 * and margins; its text is real paragraphs that wrap, each run in its own font, size, weight,
 * slant and colour; headings are Word headings; alignment, indents and spacing are kept; tables
 * are Word tables; pictures sit where they were; text in two columns is in Word's columns. A
 * scanned page, with no text, goes in as its picture (OCR first makes it text).
 */

type Docx = typeof import("docx");
type Progress = (done: number, total: number) => void;

const tw = (pt: number) => Math.max(0, Math.round(pt * 20));
/** Word measures pictures in pixels at 96 to the inch. */
const px = (pt: number) => Math.max(1, Math.round((pt * 96) / 72));

function runs(docx: Docx, list: Run[], heading = false) {
  return list.map(
    (r) =>
      new docx.TextRun({
        text: r.text,
        font: { ascii: r.font, hAnsi: r.font, cs: r.font, eastAsia: r.font },
        size: Math.max(2, Math.round(r.size * 2)),
        bold: r.bold,
        italics: r.italic,
        // Black stays automatic, so it follows Word's theme like typed text does; in a heading it's
        // set, or Word's heading colour (blue) takes over.
        ...(r.color !== "#000000" || heading ? { color: r.color.slice(1) } : {}),
      }),
  );
}

const ALIGN = (docx: Docx) =>
  ({
    left: docx.AlignmentType.LEFT,
    center: docx.AlignmentType.CENTER,
    right: docx.AlignmentType.RIGHT,
    justify: docx.AlignmentType.JUSTIFIED,
  }) as const;

const HEADINGS = (docx: Docx) => [
  undefined,
  docx.HeadingLevel.HEADING_1,
  docx.HeadingLevel.HEADING_2,
  docx.HeadingLevel.HEADING_3,
];

/** Word puts a line's baseline this far (times the size) above the bottom of a line of exact height. */
const DESCENT = 0.22;
const firstSize = (b: ParagraphBlock) =>
  Math.max(...(b.lines[0]?.runs ?? b.runs).map((r) => r.size), 1);
const lastSize = (b: ParagraphBlock) =>
  Math.max(...(b.lines[b.lines.length - 1]?.runs ?? b.runs).map((r) => r.size), 1);
/** A paragraph's line height: as on the page, or for one line, a little over its size. */
const lineOf = (b: ParagraphBlock) => b.lineHeight ?? firstSize(b) * 1.2;
/** Where a block starts and ends as Word lays it out: for a paragraph, from its baselines. */
const startOf = (b: Block) =>
  b.kind === "paragraph" && b.lines[0]
    ? b.lines[0].baseline - (lineOf(b) - firstSize(b) * DESCENT)
    : b.top;
const endOf = (b: Block) =>
  b.kind === "paragraph" && b.lines.length
    ? (b.lines[b.lines.length - 1] as Line).baseline + lastSize(b) * DESCENT
    : b.bottom;

function paragraph(
  docx: Docx,
  b: ParagraphBlock,
  left: number,
  before = b.spaceBefore,
  /** Ends the column after it: the next words start the next column. */
  endsColumn = false,
) {
  const indentLeft = b.align === "left" || b.align === "justify" ? b.left - left : 0;
  return new docx.Paragraph({
    ...(b.heading ? { heading: HEADINGS(docx)[b.heading] } : {}),
    alignment: ALIGN(docx)[b.align],
    // Arabic and Hebrew read right to left.
    bidirectional: /[֐-ࣿ]/.test(b.runs.map((r) => r.text).join("")),
    // Every line at the height it had, so each baseline lands where it was.
    spacing: {
      before: tw(before),
      after: 0,
      line: tw(lineOf(b)),
      lineRule: docx.LineRuleType.EXACT,
    },
    indent: {
      left: tw(indentLeft),
      ...(b.firstLine > 0 ? { firstLine: tw(b.firstLine) } : {}),
      ...(b.firstLine < 0 ? { hanging: tw(-b.firstLine) } : {}),
    },
    keepLines: !!b.heading,
    keepNext: !!b.heading,
    children: [
      ...runs(docx, b.runs, !!b.heading),
      ...(endsColumn ? [new docx.TextRun({ children: [new docx.ColumnBreak()] })] : []),
    ],
  });
}

function picture(
  docx: Docx,
  b: Extract<Block, { kind: "picture" }>,
  left: number,
  file: { bytes: Uint8Array; type: "png" | "jpg" } | undefined,
  before = b.spaceBefore,
) {
  if (!file) return null;
  return new docx.Paragraph({
    spacing: { before: tw(before), after: 0 },
    indent: { left: tw(Math.max(0, b.left - left)) },
    children: [
      new docx.ImageRun({
        type: file.type,
        data: file.bytes,
        transformation: { width: px(b.right - b.left), height: px(b.bottom - b.top) },
      }),
    ],
  });
}

type Section = {
  properties: Record<string, unknown>;
  headers?: Record<string, unknown>;
  footers?: Record<string, unknown>;
  children: (InstanceType<Docx["Paragraph"]> | InstanceType<Docx["Table"]>)[];
};

/**
 * A page's running head and foot: short lines at the very top or bottom, set apart from the text
 * (a page number, a title repeated on every page). They go in Word's header and footer, where
 * they stay put however the text in between flows; in the text they'd push it onto a page more.
 */
function marginal(layout: PageLayout) {
  const blocks = layout.blocks;
  const small = (b: Block): b is ParagraphBlock =>
    b.kind === "paragraph" && !b.column && b.lines.length <= 2;
  let foot = blocks.length;
  while (foot > 0) {
    const b = blocks[foot - 1] as Block;
    const before = blocks[foot - 2];
    if (!small(b) || b.top < layout.height * 0.88) break;
    if (before && b.top - before.bottom < 12) break;
    foot--;
  }
  let head = 0;
  while (head < foot) {
    const b = blocks[head] as Block;
    const after = blocks[head + 1];
    if (!small(b) || b.bottom > layout.height * 0.1) break;
    if (after && after.top - b.bottom < 12) break;
    head++;
  }
  return {
    header: blocks.slice(0, head) as ParagraphBlock[],
    body: blocks.slice(head, foot),
    footer: blocks.slice(foot) as ParagraphBlock[],
  };
}

const itemStart = (b: Block | SideBySide) =>
  b.kind === "sideBySide" ? Math.min(...[...b.left, ...b.right].map(startOf)) : startOf(b);
const itemEnd = (b: Block | SideBySide) =>
  b.kind === "sideBySide" ? Math.max(...[...b.left, ...b.right].map(endOf)) : endOf(b);

/** An empty line as tall as a gap: the space above a table, which has no space-before of its own. */
const spacer = (docx: Docx, height: number) =>
  new docx.Paragraph({
    spacing: { before: 0, after: 0, line: tw(height), lineRule: docx.LineRuleType.EXACT },
    children: [],
  });

/** Lines side by side as a table without lines: each side a cell, each line where it was. */
function besideTable(docx: Docx, b: SideBySide, left: number) {
  const none = { style: docx.BorderStyle.NONE, size: 0, color: "auto" };
  const top = itemStart(b);
  const cell = (list: ParagraphBlock[], from: number, width: number) => {
    let end = top;
    return new docx.TableCell({
      width: { size: tw(width), type: docx.WidthType.DXA },
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      children: list.map((p) => {
        const para = paragraph(docx, p, from, Math.max(0, startOf(p) - end));
        end = endOf(p);
        return para;
      }),
    });
  };
  const lw = b.gutter - b.x0;
  const rw = Math.max(12, b.x1 - b.gutter + 1);
  return new docx.Table({
    columnWidths: [tw(lw), tw(rw)],
    width: { size: tw(lw + rw), type: docx.WidthType.DXA },
    indent: { size: tw(b.x0 - left), type: docx.WidthType.DXA },
    layout: docx.TableLayoutType.FIXED,
    borders: {
      top: none,
      bottom: none,
      left: none,
      right: none,
      insideHorizontal: none,
      insideVertical: none,
    },
    rows: [
      new docx.TableRow({
        children: [cell(b.left, b.x0, lw), cell(b.right, b.gutter, rw)],
      }),
    ],
  });
}

/** One page's sections: one for the page, and continuous ones around text in two columns. */
function pageSections(
  docx: Docx,
  layout: PageLayout,
  files: Map<number, { bytes: Uint8Array; type: "png" | "jpg" }>,
  first: boolean,
): Section[] {
  const { header, body, footer } = marginal(layout);
  const top = Math.max(18, Math.min(...body.map(startOf), layout.height / 2));
  const bodyEnd = Math.max(...body.map(endOf), top);
  const footTop = footer.length ? Math.min(...footer.map(startOf)) : layout.height;
  const page = {
    size: { width: tw(layout.width), height: tw(layout.height) },
    margin: {
      top: tw(top),
      // Below the text: up to the footer when there is one, else the page's own margin. Room to
      // spare, so text a hair taller in Word doesn't run onto another page.
      bottom: tw(
        footer.length
          ? Math.max(18, layout.height - footTop + 1)
          : Math.max(18, Math.min(72, layout.height - bodyEnd - 4)),
      ),
      left: tw(layout.left),
      // A point to spare: a line that just fitted on the page mustn't wrap a word early.
      right: tw(Math.max(18, layout.width - layout.right - 1)),
      ...(header.length ? { header: tw(Math.max(0, Math.min(...header.map(startOf)))) } : {}),
      ...(footer.length
        ? { footer: tw(Math.max(0, layout.height - Math.max(...footer.map(endOf)))) }
        : {}),
    },
  };
  const marginalParas = (list: ParagraphBlock[]) => {
    let end: number | null = null;
    return list.map((b) => {
      const p = paragraph(docx, b, layout.left, end === null ? 0 : Math.max(0, startOf(b) - end));
      end = endOf(b);
      return p;
    });
  };
  const sections: Section[] = [];
  let current: Section = {
    properties: { page, ...(first ? {} : { type: docx.SectionType.NEXT_PAGE }) },
    // Every page sets its own, even empty, or Word carries the last page's over.
    headers: { default: new docx.Header({ children: marginalParas(header) }) },
    footers: { default: new docx.Footer({ children: marginalParas(footer) }) },
    children: [],
  };
  // The space above each block, so its first baseline lands where it was on the page.
  let prevEnd = top;
  let beforeColumns: number | null = null;
  let lastColumn: ParagraphBlock["column"];
  let region: number | null = null;
  const items = sideBySide(body);
  items.forEach((b, i) => {
    const column = b.kind === "paragraph" ? b.column : undefined;
    if (column && !lastColumn) beforeColumns = prevEnd;
    if (column && lastColumn && column.index !== lastColumn.index)
      prevEnd = beforeColumns ?? prevEnd;
    const before = Math.max(0, itemStart(b) - prevEnd);
    prevEnd = itemEnd(b);
    lastColumn = column;
    if ((column?.region ?? null) !== region) {
      // Into or out of two columns: a continuous section break, as Word's own Columns does.
      sections.push(current);
      const twoCols = column
        ? body.filter(
            (x): x is ParagraphBlock =>
              x.kind === "paragraph" && x.column?.region === column.region,
          )
        : [];
      const leftSide = twoCols.filter((x) => x.column?.index === 0);
      const rightSide = twoCols.filter((x) => x.column?.index === 1);
      const gap =
        Math.min(...rightSide.map((x) => x.column?.left ?? 0)) -
        Math.max(...leftSide.map((x) => x.column?.right ?? 0));
      current = {
        properties: {
          page,
          type: docx.SectionType.CONTINUOUS,
          ...(column
            ? { column: { count: 2, space: tw(Math.max(12, gap)), equalWidth: true } }
            : {}),
        },
        children: [],
      };
      region = column?.region ?? null;
    }
    const left = column ? column.left : layout.left;
    if (b.kind === "sideBySide") {
      if (before > 1) current.children.push(spacer(docx, before));
      current.children.push(besideTable(docx, b, layout.left));
    } else if (b.kind === "paragraph") {
      const next = items[i + 1];
      const endsColumn =
        column?.index === 0 &&
        next?.kind === "paragraph" &&
        next.column?.region === column.region &&
        next.column.index === 1;
      current.children.push(paragraph(docx, b, left, before, endsColumn));
    } else if (b.kind === "table") {
      if (before > 1) current.children.push(spacer(docx, before));
      current.children.push(wordTable(docx, b, layout.left, (list) => runs(docx, list)));
    } else {
      const p = picture(docx, b, left, files.get(b.id), before);
      if (p) current.children.push(p);
    }
  });
  sections.push(current);
  // Word needs something in every section.
  return sections.filter((s, i) => s.children.length || i === 0);
}

/** How pages go into Word: kept looking as they are, as flowing text, or each as suits it. */
export type WordLayout = "auto" | "exact" | "flow";

/**
 * A page kept looking as it is: its art as a picture behind, filling the page, and a marker where
 * its text boxes go in, added to the file's XML after (wordExact.ts).
 */
async function exactSection(
  docx: Docx,
  layout: PageLayout,
  background: HTMLCanvasElement,
  marker: string,
  first: boolean,
): Promise<Section> {
  const blob = await new Promise<Blob | null>((done) =>
    background.toBlob(done, "image/jpeg", 0.82),
  );
  const bytes = new Uint8Array(blob ? await blob.arrayBuffer() : new ArrayBuffer(0));
  return {
    properties: {
      page: {
        size: { width: tw(layout.width), height: tw(layout.height) },
        margin: { top: 0, bottom: 0, left: 0, right: 0, header: 0, footer: 0 },
      },
      ...(first ? {} : { type: docx.SectionType.NEXT_PAGE }),
    },
    children: [
      new docx.Paragraph({
        spacing: { before: 0, after: 0, line: 20, lineRule: docx.LineRuleType.EXACT },
        children: [
          new docx.ImageRun({
            type: "jpg",
            data: bytes,
            transformation: { width: px(layout.width), height: px(layout.height) },
            floating: {
              horizontalPosition: { relative: docx.HorizontalPositionRelativeFrom.PAGE, offset: 0 },
              verticalPosition: { relative: docx.VerticalPositionRelativeFrom.PAGE, offset: 0 },
              behindDocument: true,
              allowOverlap: true,
              wrap: { type: docx.TextWrappingType.NONE },
            },
          }),
          new docx.TextRun(marker),
        ],
      }),
    ],
  };
}

export async function toWord(
  doc: PDFDocumentProxy,
  stem: string,
  progress: Progress,
  mode: WordLayout = "auto",
): Promise<{ name: string; bytes: Uint8Array }[]> {
  const docx = await import("docx");
  const sections: Section[] = [];
  const boxes = new Map<string, string>();
  let ids = 1000;
  for (let n = 1; n <= doc.numPages; n++) {
    progress(n - 1, doc.numPages);
    const read = await readPage(doc, n, 2, { background: mode !== "flow" });
    if (read.scanned) {
      // A scanned page: its picture, so nothing is lost. OCR first makes its text editable.
      const pic = await renderPage(doc, n, 2, "jpg", 0.85);
      const w = read.layout.width;
      const h = read.layout.height;
      sections.push({
        properties: {
          page: {
            size: { width: tw(w), height: tw(h) },
            margin: { top: 0, bottom: 0, left: 0, right: 0 },
          },
          ...(n > 1 ? { type: docx.SectionType.NEXT_PAGE } : {}),
        },
        children: [
          new docx.Paragraph({
            children: [
              new docx.ImageRun({
                type: "jpg",
                data: pic.bytes,
                transformation: { width: px(w) - 2, height: px(h) - 2 },
              }),
            ],
          }),
        ],
      });
      continue;
    }
    const exact = mode === "exact" || (mode === "auto" && read.designed);
    if (exact && read.background) {
      const marker = `@@PWTB${n}@@`;
      const { xml, count } = pageBoxes(read.layout, ids);
      ids += count;
      boxes.set(marker, xml);
      sections.push(await exactSection(docx, read.layout, read.background, marker, n === 1));
    } else sections.push(...pageSections(docx, read.layout, read.pictures, n === 1));
    // Let go of this page's drawings before the next.
    read.canvas.width = 0;
    if (read.background) read.background.width = 0;
  }
  progress(doc.numPages, doc.numPages);
  const file = new docx.Document({
    styles: {
      // No space after paragraphs by default: the PDF's own spacing is set on each one.
      default: { document: { paragraph: { spacing: { after: 0 } } } },
    },
    sections: sections as never,
  });
  let bytes = new Uint8Array(await (await docx.Packer.toBlob(file)).arrayBuffer());
  if (boxes.size) {
    // The text boxes go in where their markers are.
    const { unzipSync, zipSync, strFromU8, strToU8 } = await import("fflate");
    const zip = unzipSync(bytes);
    const xml = strFromU8(zip["word/document.xml"] ?? new Uint8Array());
    zip["word/document.xml"] = strToU8(
      xml.replace(
        /<w:r>(?:(?!<w:r>)[\s\S])*?(@@PWTB\d+@@)<\/w:t><\/w:r>/g,
        (_m, marker: string) => boxes.get(marker) ?? "",
      ),
    );
    bytes = zipSync(zip, { level: 6 });
  }
  return [{ name: `${stem}.docx`, bytes }];
}
