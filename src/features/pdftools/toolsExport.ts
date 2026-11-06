import { layoutText } from "./convert";
import { readPage } from "./pageRead";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { fileName, fileStem, siblingPath } from "../../lib/office";
import { runTool } from "./client";
import { toPictures } from "./convert";
import { announce, writeNew } from "./files";
import { readText, type OcrLanguage } from "./ocr";
import { renderPage } from "./pdfRead";
import { ALL_PAGES, pagesOf } from "./toolsPages";
import type { Tool, ToolHost } from "./types";

/** Export as images, and Extract text. */

// So Notepad reads Arabic and other scripts in the .txt right.
const BOM = String.fromCharCode(0xfeff);

const stemOf = (host: ToolHost) => fileStem(host.path ?? host.name);
/** Where a save dialog starts: beside the PDF, under this name. */
const near = (host: ToolHost, name: string) => (host.path ? siblingPath(host.path, name) : name);

export const EXPORT_TOOLS: Tool[] = [
  {
    id: "exportImages",
    title: "Export as images",
    icon: "imagesmode",
    group: "convert",
    blurb: "Pages as PNG or JPG pictures, or a picture-only PDF",
    keywords: "png jpg jpeg image pictures export zip folder image-only flatten raster",
    fields: [
      { key: "pages", kind: "pages" },
      {
        key: "out",
        kind: "choice",
        label: "Save as",
        options: [
          { value: "folder", label: "Pictures" },
          { value: "zip", label: "One zip" },
          { value: "pdf", label: "Picture-only PDF" },
        ],
      },
      {
        key: "type",
        kind: "choice",
        label: "Type",
        options: [
          { value: "png", label: "PNG" },
          { value: "jpg", label: "JPG" },
        ],
      },
      {
        key: "dpi",
        kind: "choice",
        label: "Sharpness",
        options: [
          { value: "96", label: "Screen" },
          { value: "150", label: "Good" },
          { value: "300", label: "Print" },
        ],
      },
      {
        key: "note",
        kind: "note",
        text: "In a picture-only PDF, text can't be selected or copied.",
      },
    ],
    defaults: { pages: ALL_PAGES, out: "folder", type: "png", dpi: "150" },
    action: "Export",
    async run(host, v, progress) {
      const pages = pagesOf(host, v.pages);
      const dpi = Number(v.dpi);
      const stem = stemOf(host);
      if (v.out === "pdf") {
        const pictures = [];
        for (let i = 0; i < pages.length; i++) {
          progress(i, pages.length);
          const page = pages[i] ?? 1;
          pictures.push({
            page,
            jpg: (await renderPage(host.doc, page, dpi / 72, "jpg", 0.9)).bytes,
          });
        }
        await host.replace(
          await runTool("redactPages", [await host.current(), pictures]),
          pictures.length === host.doc.numPages
            ? "Every page is a picture now: nothing can be selected or copied."
            : `${pictures.length} ${pictures.length === 1 ? "page is" : "pages are"} pictures now.`,
        );
        return;
      }
      const type = v.type as "png" | "jpg";
      const files = await toPictures(host.doc, stem, { type, dpi, pages }, progress);
      const [one] = files;
      if (files.length === 1 && one) {
        const path = await save({
          defaultPath: near(host, one.name),
          filters: [{ name: type.toUpperCase(), extensions: [type] }],
        });
        if (!path) return;
        announce([await writeNew(path, one.bytes)]);
        return;
      }
      if (v.out === "zip") {
        const path = await save({
          defaultPath: near(host, `${stem} pictures.zip`),
          filters: [{ name: "Zip", extensions: ["zip"] }],
        });
        if (!path) return;
        const { zipSync } = await import("fflate");
        // Pictures are packed already; zipping them again would only cost time.
        const zip = zipSync(Object.fromEntries(files.map((f) => [f.name, f.bytes])), { level: 0 });
        const written = await writeNew(path, zip);
        announce([written], `${files.length} pictures saved in "${fileName(written)}".`);
        return;
      }
      const parent = await open({
        directory: true,
        defaultPath: host.path ? siblingPath(host.path, "") : undefined,
        title: "Where should the pictures go?",
      });
      if (typeof parent !== "string") return;
      const folder = await invoke<string>("make_folder", { parent, name: `${stem} pictures` });
      const written: string[] = [];
      for (const f of files) written.push(await writeNew(`${folder}\\${f.name}`, f.bytes));
      announce(written, `${files.length} pictures saved in "${fileName(folder)}".`);
    },
  },
  {
    id: "extractText",
    title: "Extract text",
    icon: "text_snippet",
    group: "ocr",
    blurb: "All its text as a .txt file and on the clipboard, scanned pages read too",
    keywords: "text copy extract ocr scan words",
    fields: [
      {
        key: "langs",
        kind: "chips",
        label: "Languages on scanned pages",
        options: [
          { value: "eng", label: "English" },
          { value: "ara", label: "Arabic" },
        ],
      },
      { key: "pages", kind: "pages" },
    ],
    defaults: { langs: ["eng"], pages: ALL_PAGES },
    action: "Extract",
    async run(host, v, progress) {
      const pages = pagesOf(host, v.pages);
      const langs = v.langs as OcrLanguage[];
      // Pages with text give it straight away; the rest are read with OCR.
      const texts = new Map<number, string>();
      const scanned: number[] = [];
      for (const n of pages) {
        const { layout, scanned: none } = await readPage(host.doc, n, 1);
        const text = layoutText(layout);
        if (!none && text.trim().length > 8) texts.set(n, text);
        else scanned.push(n);
      }
      if (scanned.length && !langs.length)
        throw new Error("Pick a language for the scanned pages.");
      for (const [n, text] of await readText(host.doc, scanned, langs, progress))
        texts.set(n, text.replace(/\n/g, "\r\n"));
      const text = pages.map((n) => texts.get(n) ?? "").join("\r\n\r\n");
      if (!text.trim()) return "No text was found on those pages.";
      await navigator.clipboard.writeText(text.replace(/\r\n/g, "\n")).catch(() => {});
      if (!host.path) return "The text is on the clipboard.";
      const written = await writeNew(
        siblingPath(host.path, `${stemOf(host)} text.txt`),
        new TextEncoder().encode(BOM + text),
      );
      announce([written], `Text copied, and saved as "${fileName(written)}".`);
    },
  },
];
