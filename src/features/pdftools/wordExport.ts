import type { PDFDocumentProxy } from "pdfjs-dist";
import type {
  Block,
  PageLayout,
  ParagraphBlock,
  Run,
  TableBlock,
} from "../../lib/pdftools/pageLayout";
import { readPage } from "./pageRead";
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

function runs(docx: Docx, list: Run[]) {
  return list.map(
    (r) =>
      new docx.TextRun({
        text: r.text,
        font: { ascii: r.font, hAnsi: r.font, cs: r.font, eastAsia: r.font },
        size: Math.max(2, Math.round(r.size * 2)),
        bold: r.bold,
        italics: r.italic,
        // Black stays automatic, so it follows Word's theme like typed text does.
        ...(r.color !== "#000000" ? { color: r.color.slice(1) } : {}),
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

function paragraph(docx: Docx, b: ParagraphBlock, left: number) {
  const indentLeft = b.align === "left" || b.align === "justify" ? b.left - left : 0;
  return new docx.Paragraph({
    ...(b.heading ? { heading: HEADINGS(docx)[b.heading] } : {}),
    alignment: ALIGN(docx)[b.align],
    // Arabic and Hebrew read right to left.
    bidirectional: /[֐-ࣿ]/.test(b.runs.map((r) => r.text).join("")),
    spacing: {
      before: tw(b.spaceBefore),
      after: 0,
      ...(b.lineHeight ? { line: tw(b.lineHeight), lineRule: docx.LineRuleType.EXACT } : {}),
    },
    indent: {
      left: tw(indentLeft),
      ...(b.firstLine > 0 ? { firstLine: tw(b.firstLine) } : {}),
      ...(b.firstLine < 0 ? { hanging: tw(-b.firstLine) } : {}),
    },
    keepLines: !!b.heading,
    keepNext: !!b.heading,
    children: runs(docx, b.runs),
  });
}

function table(docx: Docx, b: TableBlock) {
  const edges = [...b.columns, b.right + 6];
  const widths = b.columns.map((c, i) => tw(Math.max(24, (edges[i + 1] ?? c + 60) - c)));
  const line = { style: docx.BorderStyle.SINGLE, size: 4, color: "8C8C8C" };
  return new docx.Table({
    columnWidths: widths,
    width: { size: widths.reduce((a, w) => a + w, 0), type: docx.WidthType.DXA },
    borders: {
      top: line,
      bottom: line,
      left: line,
      right: line,
      insideHorizontal: line,
      insideVertical: line,
    },
    rows: b.rows.map(
      (row, i) =>
        new docx.TableRow({
          tableHeader: i === 0,
          children: row.map(
            (cell, j) =>
              new docx.TableCell({
                width: { size: widths[j] ?? 1000, type: docx.WidthType.DXA },
                margins: { top: 40, bottom: 40, left: 100, right: 100 },
                children: [new docx.Paragraph({ children: runs(docx, cell) })],
              }),
          ),
        }),
    ),
  });
}

function picture(
  docx: Docx,
  b: Extract<Block, { kind: "picture" }>,
  left: number,
  file: { bytes: Uint8Array; type: "png" | "jpg" } | undefined,
) {
  if (!file) return null;
  return new docx.Paragraph({
    spacing: { before: tw(b.spaceBefore), after: 0 },
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
  children: (InstanceType<Docx["Paragraph"]> | InstanceType<Docx["Table"]>)[];
};

/** One page's sections: one for the page, and continuous ones around text in two columns. */
function pageSections(
  docx: Docx,
  layout: PageLayout,
  files: Map<number, { bytes: Uint8Array; type: "png" | "jpg" }>,
  first: boolean,
): Section[] {
  const page = {
    size: { width: tw(layout.width), height: tw(layout.height) },
    margin: {
      top: tw(Math.max(18, layout.top)),
      bottom: tw(Math.max(36, Math.min(72, layout.height - layout.bottom - 4))),
      left: tw(layout.left),
      right: tw(Math.max(18, layout.width - layout.right)),
    },
  };
  const sections: Section[] = [];
  let current: Section = {
    properties: { page, ...(first ? {} : { type: docx.SectionType.NEXT_PAGE }) },
    children: [],
  };
  let region: number | null = null;
  for (const b of layout.blocks) {
    const column = b.kind === "paragraph" ? b.column : undefined;
    if ((column?.region ?? null) !== region) {
      // Into or out of two columns: a continuous section break, as Word's own Columns does.
      sections.push(current);
      const twoCols = column
        ? layout.blocks.filter(
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
    if (b.kind === "paragraph") {
      const prev = current.children.length
        ? layout.blocks[layout.blocks.indexOf(b) - 1]
        : undefined;
      if (column?.index === 1 && prev?.kind === "paragraph" && prev.column?.index === 0)
        current.children.push(new docx.Paragraph({ children: [new docx.ColumnBreak()] }));
      current.children.push(paragraph(docx, b, left));
    } else if (b.kind === "table") {
      if (b.spaceBefore > 2)
        current.children.push(
          new docx.Paragraph({
            spacing: {
              before: 0,
              after: 0,
              line: tw(b.spaceBefore),
              lineRule: docx.LineRuleType.EXACT,
            },
            children: [],
          }),
        );
      current.children.push(table(docx, b));
    } else {
      const p = picture(docx, b, left, files.get(b.id));
      if (p) current.children.push(p);
    }
  }
  sections.push(current);
  // Word needs something in every section.
  return sections.filter((s, i) => s.children.length || i === 0);
}

export async function toWord(
  doc: PDFDocumentProxy,
  stem: string,
  progress: Progress,
): Promise<{ name: string; bytes: Uint8Array }[]> {
  const docx = await import("docx");
  const sections: Section[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    progress(n - 1, doc.numPages);
    const read = await readPage(doc, n, 2);
    if (read.scanned) {
      // A scanned page: its picture, so nothing is lost. OCR first makes its text editable.
      const pic = await renderPage(doc, n, 2, "jpg", 0.88);
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
    sections.push(...pageSections(docx, read.layout, read.pictures, n === 1));
  }
  progress(doc.numPages, doc.numPages);
  const file = new docx.Document({
    styles: {
      // No space after paragraphs by default: the PDF's own spacing is set on each one.
      default: { document: { paragraph: { spacing: { after: 0 } } } },
    },
    sections: sections as never,
  });
  const blob = await docx.Packer.toBlob(file);
  return [{ name: `${stem}.docx`, bytes: new Uint8Array(await blob.arrayBuffer()) }];
}
