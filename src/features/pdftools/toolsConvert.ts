import { invoke } from "@tauri-apps/api/core";
import { fileStem } from "../../lib/office";
import { runTool } from "./client";
import { compare } from "./compare";
import { toExcel, toPowerPoint, toText, toWord } from "./convert";
import type { WordLayout } from "./wordExport";
import { deliver } from "./files";
import { loadPdf, PDF_ASSETS } from "../office/pdfLoader";
import { pagesWithoutText, recognize, type OcrLanguage } from "./ocr";
import { asPngOrJpg } from "./pdfRead";
import { ALL_PAGES, pagesOf } from "./toolsPages";
import type { Tool, ToolHost } from "./types";

/** Convert, Scan and compare, and the file itself. */

const sourceOf = (host: ToolHost) => {
  if (!host.path)
    throw new Error("Save this PDF first, so there's a folder to put the new file in.");
  return host.path;
};
const stemOf = (host: ToolHost) => fileStem(host.path ?? host.name);

function convertTool(
  id: string,
  title: string,
  icon: string,
  blurb: string,
  keywords: string,
  make: typeof toWord,
): Tool {
  return {
    id,
    title,
    icon,
    group: "convert",
    blurb,
    keywords,
    instant: true,
    async run(host, _v, progress) {
      await deliver(sourceOf(host), await make(host.doc, stemOf(host), progress), "");
    },
  };
}

export const CONVERT_TOOLS: Tool[] = [
  {
    id: "toWord",
    title: "PDF to Word",
    icon: "description",
    group: "convert",
    blurb: "An editable .docx",
    keywords: "docx doc convert export",
    fields: [
      {
        key: "layout",
        kind: "choice",
        label: "Layout",
        options: [
          { value: "auto", label: "Automatic" },
          { value: "exact", label: "Keep the look" },
          { value: "flow", label: "Flowing text" },
        ],
      },
      {
        key: "note",
        kind: "note",
        text: "Keep the look puts the text in boxes over a picture of each page. Flowing text is easier to edit. Automatic picks per page.",
      },
    ],
    defaults: { layout: "auto" },
    action: "Convert",
    async run(host, v, progress) {
      await deliver(
        sourceOf(host),
        await toWord(host.doc, stemOf(host), progress, v.layout as WordLayout),
        "",
      );
    },
  },
  convertTool(
    "toExcel",
    "PDF to Excel",
    "table_chart",
    "Each page's table as a sheet, numbers as numbers",
    "xlsx spreadsheet table convert export",
    toExcel,
  ),
  convertTool(
    "toPowerPoint",
    "PDF to PowerPoint",
    "slideshow",
    "Each page as a slide, its text in the notes",
    "pptx slides presentation convert export",
    toPowerPoint,
  ),
  {
    id: "extractImages",
    title: "Extract images",
    icon: "photo_library",
    group: "convert",
    blurb: "The pictures inside the PDF, as they are",
    keywords: "photos pictures save images",
    instant: true,
    async run(host, _v, progress) {
      const files = await runTool("extractImages", [await host.current()], progress);
      if (!files.length) return "This PDF has no pictures Penwork can take out.";
      const stem = stemOf(host);
      await deliver(
        sourceOf(host),
        files.map((f) => ({ ...f, name: `${stem} ${f.name}` })),
        "images",
      );
    },
  },
  convertTool(
    "toText",
    "PDF to text",
    "notes",
    "Its words as a plain .txt file",
    "txt plain text copy",
    (doc, stem, p) => toText(doc, stem, "txt", p),
  ),
  convertTool(
    "toMarkdown",
    "PDF to Markdown",
    "markdown",
    "Headings, lists and paragraphs as .md",
    "md markdown",
    (doc, stem, p) => toText(doc, stem, "md", p),
  ),
  {
    id: "imagesToPdf",
    title: "Pictures to PDF",
    icon: "add_photo_alternate",
    group: "convert",
    blurb: "Photos or scans into a new PDF, a page each",
    keywords: "jpg png images to pdf photos scan",
    fields: [
      { key: "files", kind: "files", label: "Pictures", accept: "image", multiple: true },
      {
        key: "paper",
        kind: "choice",
        label: "Page size",
        options: [
          { value: "fit", label: "Same as picture" },
          { value: "a4", label: "A4" },
          { value: "letter", label: "Letter" },
        ],
      },
      {
        key: "margin",
        kind: "choice",
        label: "Margin",
        options: [
          { value: "0", label: "None" },
          { value: "18", label: "Small" },
          { value: "40", label: "Big" },
        ],
      },
    ],
    defaults: { files: [], paper: "a4", margin: "18" },
    action: "Make PDF",
    async run(_host, v, progress) {
      const files = v.files as { bytes: Uint8Array; name: string; path: string }[];
      if (!files.length) throw new Error("Pick the pictures first.");
      const images = [];
      for (let i = 0; i < files.length; i++) {
        progress(i, files.length);
        const file = files[i];
        if (file) images.push(await asPngOrJpg(file.bytes, file.name));
      }
      const bytes = await runTool("imagesToPdf", [
        images,
        { paper: v.paper as "fit" | "a4" | "letter", margin: Number(v.margin) },
      ]);
      const first = files[0]?.path ?? "";
      await deliver(first, [{ name: `${fileStem(first)}.pdf`, bytes }], "");
    },
  },
  {
    id: "ocr",
    title: "Recognize text (OCR)",
    icon: "document_scanner",
    group: "ocr",
    blurb: "Reads scanned pages, so their text can be found, selected and copied",
    keywords: "ocr scan recognize text searchable arabic english",
    fields: [
      {
        key: "langs",
        kind: "chips",
        label: "Languages on the pages",
        options: [
          { value: "eng", label: "English" },
          { value: "ara", label: "Arabic" },
        ],
      },
      {
        key: "which",
        kind: "choice",
        label: "Read",
        options: [
          { value: "scanned", label: "Pages without text" },
          { value: "all", label: "Every page" },
        ],
      },
    ],
    defaults: { langs: ["eng"], which: "scanned" },
    action: "Read the pages",
    async run(host, v, progress) {
      const langs = v.langs as OcrLanguage[];
      if (!langs.length) throw new Error("Pick at least one language.");
      const pages = v.which === "all" ? pagesOf(host, ALL_PAGES) : await pagesWithoutText(host.doc);
      if (!pages.length) return "Every page already has text. Pick Every page to read them again.";
      const found = await recognize(host.doc, pages, langs, progress);
      const words = found.reduce((n, p) => n + p.words.length, 0);
      if (!words) return "No text was found on those pages.";
      await host.replace(
        await runTool("addOcrText", [await host.current(), found]),
        `Read ${words} words on ${found.length} ${found.length === 1 ? "page" : "pages"}. They can be searched now.`,
      );
    },
  },
  {
    id: "compare",
    title: "Compare PDFs",
    icon: "difference",
    group: "more",
    blurb: "What changed between this PDF and another version",
    keywords: "diff differences versions changes",
    fields: [
      { key: "files", kind: "files", label: "The other version", accept: "pdf", multiple: false },
    ],
    defaults: { files: [] },
    action: "Compare",
    async run(host, v, progress) {
      const [other] = v.files as { bytes: Uint8Array }[];
      if (!other) throw new Error("Pick the other PDF first.");
      const { pdfjs } = await loadPdf();
      const task = pdfjs.getDocument({ ...PDF_ASSETS, data: other.bytes.slice() });
      const otherDoc = await task.promise;
      try {
        return await compare(host.doc, otherDoc, progress);
      } finally {
        void task.destroy();
      }
    },
  },
  {
    id: "showInFolder",
    title: "Show in folder",
    icon: "folder_open",
    group: "more",
    blurb: "Where this PDF is, in File Explorer",
    keywords: "explorer location path",
    instant: true,
    when: (host) => host.path !== null,
    async run(host) {
      if (host.path) await invoke("show_in_folder", { path: host.path });
    },
  },
];
