import { fileStem } from "../../lib/office";
import { describePages, pageSet, splitGroups } from "../../lib/pdftools/ranges";
import { runTool } from "./client";
import { deliver, pickFiles } from "./files";
import { renderPage } from "./pdfRead";
import type { Tool, ToolHost, Values } from "./types";

/** Organize and Optimize: the page list and the file's size and health. */

export interface PagesValue {
  which: "all" | "this" | "some";
  ranges: string;
}

export const ALL_PAGES: PagesValue = { which: "all", ranges: "" };

export function pagesOf(host: ToolHost, v: unknown): number[] {
  const p = (v as PagesValue | undefined) ?? ALL_PAGES;
  const count = host.doc.numPages;
  if (p.which === "this") return [host.page];
  if (p.which === "some") {
    const pages = pageSet(p.ranges, count);
    if (!pages?.length) throw new Error(`Type pages between 1 and ${count}, like "1-3, 5".`);
    return pages;
  }
  return Array.from({ length: count }, (_, i) => i + 1);
}

const stemOf = (host: ToolHost) => fileStem(host.path ?? host.name);
const sourceOf = (host: ToolHost) => {
  if (!host.path)
    throw new Error("Save this PDF first, so there's a folder to put the new files in.");
  return host.path;
};

const kb = (n: number) =>
  n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

/** Mostly white, with no text: what a scanner's empty back side looks like. */
async function isBlank(host: ToolHost, n: number): Promise<boolean> {
  const page = await host.doc.getPage(n);
  const text = await page.getTextContent();
  if (text.items.some((i) => "str" in i && i.str.trim())) return false;
  const pic = await renderPage(
    host.doc,
    n,
    96 / Math.max(page.view[2] ?? 1, page.view[3] ?? 1),
    "png",
  );
  const ctx = pic.canvas.getContext("2d");
  if (!ctx) return false;
  const px = ctx.getImageData(0, 0, pic.canvas.width, pic.canvas.height).data;
  let ink = 0;
  for (let i = 0; i < px.length; i += 4)
    if ((px[i] ?? 255) + (px[i + 1] ?? 255) + (px[i + 2] ?? 255) < 3 * 235) ink++;
  return ink / (px.length / 4) < 0.004;
}

export const PAGE_TOOLS: Tool[] = [
  {
    id: "organize",
    title: "Organize pages",
    icon: "grid_view",
    group: "pages",
    blurb: "Drag pages into order, turn, copy or delete them",
    keywords: "sort reorder move arrange duplicate",
    instant: true,
    async run(host) {
      host.organize();
    },
  },
  {
    id: "merge",
    title: "Merge PDFs",
    icon: "merge",
    group: "pages",
    blurb: "Add other PDFs' pages to this one",
    keywords: "combine join append",
    fields: [
      { key: "files", kind: "files", label: "PDFs to add", accept: "pdf", multiple: true },
      {
        key: "where",
        kind: "choice",
        label: "Put them",
        options: [
          { value: "end", label: "After this one" },
          { value: "start", label: "Before it" },
        ],
      },
    ],
    defaults: { files: [], where: "end" },
    action: "Merge",
    async run(host, v, progress) {
      const files = v.files as { bytes: Uint8Array; name: string }[];
      if (!files.length) throw new Error("Pick the PDFs to add first.");
      const out = await runTool(
        "merge",
        [await host.current(), files.map((f) => f.bytes), v.where as "end" | "start"],
        progress,
      );
      await host.replace(
        out,
        `Added ${files.length === 1 ? `"${files[0]?.name ?? ""}"` : `${files.length} PDFs`}.`,
      );
    },
  },
  {
    id: "split",
    title: "Split PDF",
    icon: "call_split",
    group: "pages",
    blurb: "Into one file per page, per few pages, or per range",
    keywords: "separate divide break",
    fields: [
      {
        key: "how",
        kind: "choice",
        label: "Split",
        options: [
          { value: "every", label: "Every page" },
          { value: "n", label: "Every few pages" },
          { value: "ranges", label: "By ranges" },
        ],
      },
      { key: "n", kind: "slider", label: "Pages in each file", min: 2, max: 50, step: 1 },
      {
        key: "ranges",
        kind: "text",
        label: "Ranges, one file each",
        placeholder: "1-3, 4-10, 11-",
      },
    ],
    defaults: { how: "every", n: 2, ranges: "" },
    action: "Split",
    async run(host, v, progress) {
      const source = sourceOf(host);
      const count = host.doc.numPages;
      const groups =
        v.how === "ranges"
          ? splitGroups({ ranges: String(v.ranges) }, count)
          : splitGroups({ every: v.how === "every" ? 1 : Number(v.n) }, count);
      if (!groups?.length) throw new Error(`Type ranges between 1 and ${count}, like "1-3, 4-10".`);
      const parts = await runTool("split", [await host.current(), groups], progress);
      const stem = stemOf(host);
      await deliver(
        source,
        parts.map((bytes, i) => ({
          name: `${stem} pages ${describePages(groups[i] ?? []).replace(/, /g, "+")}.pdf`,
          bytes,
        })),
        "split",
      );
    },
  },
  {
    id: "extract",
    title: "Extract pages",
    icon: "file_export",
    group: "pages",
    blurb: "Copy some pages out into a new PDF",
    keywords: "take save pages new file",
    fields: [{ key: "pages", kind: "pages" }],
    defaults: { pages: { which: "this", ranges: "" } },
    action: "Extract",
    async run(host, v) {
      const pages = pagesOf(host, v.pages);
      const bytes = await runTool("copyOut", [await host.current(), pages]);
      await deliver(
        sourceOf(host),
        [{ name: `${stemOf(host)} pages ${describePages(pages)}.pdf`, bytes }],
        "",
      );
    },
  },
  {
    id: "remove",
    title: "Remove pages",
    icon: "delete_sweep",
    group: "pages",
    blurb: "Take pages out of this PDF",
    keywords: "delete cut",
    fields: [{ key: "pages", kind: "pages" }],
    defaults: { pages: { which: "this", ranges: "" } },
    action: "Remove",
    async run(host, v) {
      const pages = pagesOf(host, v.pages);
      if (pages.length >= host.doc.numPages)
        throw new Error("That's every page. A PDF needs at least one.");
      await host.replace(
        await runTool("removePages", [await host.current(), pages]),
        `Removed ${pages.length === 1 ? "page" : "pages"} ${describePages(pages)}.`,
      );
    },
  },
  {
    id: "rotate",
    title: "Rotate pages",
    icon: "rotate_right",
    group: "pages",
    blurb: "Turn pages that are sideways or upside down",
    keywords: "turn orientation landscape",
    fields: [
      {
        key: "turn",
        kind: "choice",
        label: "Turn",
        options: [
          { value: "90", label: "Right" },
          { value: "180", label: "Upside down" },
          { value: "270", label: "Left" },
        ],
      },
      { key: "pages", kind: "pages" },
    ],
    defaults: { turn: "90", pages: ALL_PAGES },
    action: "Rotate",
    async run(host, v) {
      const pages = pagesOf(host, v.pages);
      await host.replace(
        await runTool("rotatePages", [await host.current(), pages, Number(v.turn)]),
        "Pages turned.",
      );
    },
  },
  {
    id: "blank",
    title: "Add blank pages",
    icon: "note_add",
    group: "pages",
    blurb: "Empty pages, for notes or to make a booklet even",
    keywords: "insert empty new page",
    fields: [
      {
        key: "after",
        kind: "slider",
        label: "After page",
        min: 0,
        max: 9999,
        step: 1,
        format: (n) => (n === 0 ? "At the start" : `${n}`),
      },
      { key: "count", kind: "slider", label: "How many", min: 1, max: 20, step: 1 },
    ],
    defaults: (host) => ({ after: host.page, count: 1 }),
    action: "Add",
    async run(host, v) {
      const after = Math.min(Number(v.after), host.doc.numPages);
      const count = Number(v.count);
      await host.replace(
        await runTool("insertBlank", [await host.current(), after, count]),
        count === 1 ? "Added a blank page." : `Added ${count} blank pages.`,
      );
    },
  },
  {
    id: "reverse",
    title: "Reverse page order",
    icon: "swap_vert",
    group: "pages",
    blurb: "Last page first, for scans fed in backwards",
    keywords: "backwards flip order",
    instant: true,
    async run(host) {
      await host.replace(await runTool("reversePages", [await host.current()]), "Pages reversed.");
    },
  },
  {
    id: "removeBlank",
    title: "Remove blank pages",
    icon: "hide_source",
    group: "pages",
    blurb: "Finds empty pages, like a scan's back sides, and takes them out",
    keywords: "empty white scan clean",
    instant: true,
    async run(host, _v, progress) {
      const blank: number[] = [];
      for (let n = 1; n <= host.doc.numPages; n++) {
        progress(n - 1, host.doc.numPages);
        if (await isBlank(host, n)) blank.push(n);
      }
      if (!blank.length) return "No blank pages found.";
      if (blank.length === host.doc.numPages)
        return "Every page looks blank, so none were removed.";
      await host.replace(
        await runTool("removePages", [await host.current(), blank]),
        `Removed ${blank.length} blank ${blank.length === 1 ? "page" : "pages"} (${describePages(blank)}).`,
      );
    },
  },
  {
    id: "compress",
    title: "Compress",
    icon: "compress",
    group: "optimize",
    blurb: "A smaller file, to send or upload",
    keywords: "reduce size shrink smaller optimize",
    fields: [
      {
        key: "level",
        kind: "choice",
        label: "How much",
        options: [
          { value: "light", label: "A little" },
          { value: "recommended", label: "Recommended" },
          { value: "strong", label: "A lot" },
        ],
      },
      {
        key: "note",
        kind: "note",
        text: "Stronger compression makes images softer. Text stays sharp.",
      },
    ],
    defaults: { level: "recommended" },
    action: "Compress",
    async run(host, v, progress) {
      const before = await host.current();
      const r = await runTool(
        "compress",
        [before, v.level as "light" | "recommended" | "strong"],
        progress,
      );
      if (r.after >= r.before * 0.98) return "This PDF is already about as small as it gets.";
      const saved = Math.round((1 - r.after / r.before) * 100);
      await host.replace(
        r.bytes,
        `${saved}% smaller: ${kb(r.before)} → ${kb(r.after)}. Save to keep it.`,
      );
    },
  },
  {
    id: "repair",
    title: "Repair",
    icon: "build",
    group: "optimize",
    blurb: "Rebuilds a damaged file's structure",
    keywords: "fix broken corrupt damaged",
    instant: true,
    async run(host) {
      await host.replace(
        await runTool("repair", [await host.current()]),
        "Rebuilt. Save to keep the repaired file.",
      );
    },
  },
  {
    id: "flatten",
    title: "Flatten",
    icon: "layers_clear",
    group: "optimize",
    blurb: "Forms, notes and ink become part of the page, for good",
    keywords: "form fields annotations lock merge layers",
    fields: [
      { key: "links", kind: "switch", label: "Keep links working" },
      { key: "pages", kind: "pages" },
    ],
    defaults: { links: true, pages: ALL_PAGES },
    action: "Flatten",
    async run(host, v) {
      const r = await runTool("flatten", [
        await host.current(),
        { pages: pagesOf(host, v.pages), keepLinks: Boolean(v.links) },
      ]);
      if (!r.count) return "There was nothing to flatten: no form, notes or ink.";
      await host.replace(
        r.bytes,
        `Flattened ${r.count} ${r.count === 1 ? "item" : "items"} into the pages.`,
      );
    },
  },
  {
    id: "details",
    title: "File details",
    icon: "info",
    group: "more",
    blurb: "Title, author and keywords, or remove them all",
    keywords: "metadata properties title author privacy",
    fields: [
      { key: "title", kind: "text", label: "Title" },
      { key: "author", kind: "text", label: "Author" },
      { key: "subject", kind: "text", label: "Subject" },
      { key: "keywords", kind: "text", label: "Keywords", placeholder: "Separated by commas" },
      {
        key: "clear",
        kind: "switch",
        label: "Remove all details",
        description: "For sharing a file without who made it or with what.",
      },
    ],
    defaults: async (host) => ({
      ...(await runTool("readDetails", [await host.current()])),
      clear: false,
    }),
    action: "Save details",
    async run(host, v: Values) {
      const d = v.clear
        ? "clear"
        : {
            title: String(v.title ?? ""),
            author: String(v.author ?? ""),
            subject: String(v.subject ?? ""),
            keywords: String(v.keywords ?? ""),
          };
      await host.replace(
        await runTool("writeDetails", [await host.current(), d]),
        v.clear ? "Details removed." : "Details changed.",
      );
    },
  },
];

export async function pickInto(kind: "pdf" | "image", multiple: boolean) {
  return pickFiles(kind, multiple);
}
