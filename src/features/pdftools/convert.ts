import type { PDFDocumentProxy } from "pdfjs-dist";
import { cellValue, toMarkdown, toTable, type Paragraph } from "../../lib/pdftools/textLayout";
import { pageText, renderPage } from "./pdfRead";

/**
 * PDF to Word, Excel, PowerPoint, pictures, text and Markdown. Each library is loaded only when its
 * tool runs, so none of them slows opening a PDF.
 */

type Progress = (done: number, total: number) => void;
type Out = { name: string; bytes: Uint8Array }[];

const pagesOf = (doc: PDFDocumentProxy) => Array.from({ length: doc.numPages }, (_, i) => i + 1);

export async function toWord(
  doc: PDFDocumentProxy,
  stem: string,
  progress: Progress,
): Promise<Out> {
  const docx = await import("docx");
  const children: InstanceType<typeof docx.Paragraph>[] = [];
  const headings = [
    undefined,
    docx.HeadingLevel.HEADING_1,
    docx.HeadingLevel.HEADING_2,
    docx.HeadingLevel.HEADING_3,
  ];
  for (const n of pagesOf(doc)) {
    progress(n - 1, doc.numPages);
    const { paragraphs } = await pageText(doc, n);
    const first = children.length;
    if (paragraphs.length === 0) {
      // A scanned page: its picture, so nothing is lost. OCR first makes its text editable.
      const pic = await renderPage(doc, n, 1.5, "jpg", 0.85);
      const width = 600;
      children.push(
        new docx.Paragraph({
          children: [
            new docx.ImageRun({
              type: "jpg",
              data: pic.bytes,
              transformation: { width, height: Math.round((width * pic.height) / pic.width) },
            }),
          ],
        }),
      );
    }
    for (const p of paragraphs) children.push(wordParagraph(docx, p, headings));
    if (n > 1 && children[first]) {
      // A new page where the PDF had one.
      children.splice(first, 0, new docx.Paragraph({ children: [new docx.PageBreak()] }));
    }
  }
  progress(doc.numPages, doc.numPages);
  const file = new docx.Document({
    numbering: {
      config: [
        {
          reference: "numbers",
          levels: [
            {
              level: 0,
              format: docx.LevelFormat.DECIMAL,
              text: "%1.",
              alignment: docx.AlignmentType.START,
            },
          ],
        },
      ],
    },
    sections: [{ children }],
  });
  const blob = await docx.Packer.toBlob(file);
  return [{ name: `${stem}.docx`, bytes: new Uint8Array(await blob.arrayBuffer()) }];
}

function wordParagraph(
  docx: typeof import("docx"),
  p: Paragraph,
  headings: (string | undefined)[],
) {
  const heading = headings[p.heading] as
    (typeof docx.HeadingLevel)[keyof typeof docx.HeadingLevel] | undefined;
  return new docx.Paragraph({
    ...(heading ? { heading } : {}),
    ...(p.list === "bullet" ? { bullet: { level: 0 } } : {}),
    ...(p.list === "number" ? { numbering: { reference: "numbers", level: 0 } } : {}),
    // Arabic and Hebrew read right to left.
    bidirectional: /[֐-ࣿ]/.test(p.text),
    children: [
      new docx.TextRun({
        text: p.text,
        bold: p.bold && !p.heading,
        size: p.heading ? undefined : Math.round(Math.min(Math.max(p.size, 8), 28) * 2),
      }),
    ],
  });
}

export async function toExcel(
  doc: PDFDocumentProxy,
  stem: string,
  progress: Progress,
): Promise<Out> {
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  for (const n of pagesOf(doc)) {
    progress(n - 1, doc.numPages);
    const { lines } = await pageText(doc, n);
    if (!lines.length) continue;
    const sheet = book.addWorksheet(`Page ${n}`);
    const rows = toTable(lines);
    for (const row of rows) sheet.addRow(row.map(cellValue));
    sheet.columns.forEach((col, i) => {
      const longest = Math.max(...rows.map((r) => (r[i] ?? "").length), 6);
      col.width = Math.min(60, longest + 2);
    });
  }
  if (book.worksheets.length === 0)
    book.addWorksheet("Page 1").addRow(["This PDF has no text. Run OCR on it first."]);
  progress(doc.numPages, doc.numPages);
  const data = await book.xlsx.writeBuffer();
  return [{ name: `${stem}.xlsx`, bytes: new Uint8Array(data as ArrayBuffer) }];
}

/** Each page as a slide, looking exactly as it does in the PDF. */
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
  for (const n of pagesOf(doc)) {
    progress(n - 1, doc.numPages);
    const pic = await renderPage(doc, n, 2, "jpg", 0.88);
    const slide = deck.addSlide();
    // A page of another shape is fitted in the middle.
    const s = Math.min(w / (pic.width / 144), h / (pic.height / 144));
    const pw = (pic.width / 144) * s;
    const ph = (pic.height / 144) * s;
    let b64 = "";
    for (let i = 0; i < pic.bytes.length; i += 0x8000)
      b64 += String.fromCharCode(...pic.bytes.subarray(i, i + 0x8000));
    slide.addImage({
      data: `data:image/jpeg;base64,${btoa(b64)}`,
      x: (w - pw) / 2,
      y: (h - ph) / 2,
      w: pw,
      h: ph,
    });
    const { paragraphs } = await pageText(doc, n);
    if (paragraphs.length) slide.addNotes(paragraphs.map((p) => p.text).join("\n"));
  }
  progress(doc.numPages, doc.numPages);
  const data = (await deck.write({ outputType: "uint8array" })) as Uint8Array;
  return [{ name: `${stem}.pptx`, bytes: data }];
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
    const { paragraphs, lines } = await pageText(doc, n);
    parts.push(kind === "md" ? toMarkdown(paragraphs) : lines.map((l) => l.text).join("\r\n"));
  }
  progress(doc.numPages, doc.numPages);
  const text = parts.join(kind === "md" ? "\n\n---\n\n" : "\r\n\f\r\n");
  // A byte-order mark, so Notepad reads Arabic and other scripts right.
  const bytes = new TextEncoder().encode((kind === "txt" ? "﻿" : "") + text);
  return [{ name: `${stem}.${kind}`, bytes }];
}
