import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { fileStem } from "../../lib/office";
import { showError } from "../notices/notices";
import { deliver } from "../pdftools/files";
import type { OfficeEditor, OfficeFile } from "./officeFile";

/**
 * Word and spreadsheets to PDF, through WebView2's own printing: what's printed is a copy of the
 * pages put alone on the page (#pw-print), so the PDF has the document and nothing of the app.
 */

const PX_PER_INCH = 96;

function printArea(): HTMLElement {
  document.getElementById("pw-print")?.remove();
  const area = document.createElement("div");
  area.id = "pw-print";
  document.body.append(area);
  return area;
}

/** The Word editor's pages, as drawn: each becomes one PDF page. */
function wordPages(area: HTMLElement): { width: number; height: number } {
  const pages = document.querySelector(".docx-pages");
  if (!pages) throw new Error("The document isn't shown yet.");
  const copy = pages.cloneNode(true) as HTMLElement;
  copy.removeAttribute("style");
  area.append(copy);
  const first = pages.firstElementChild?.getBoundingClientRect();
  // The page size as on screen, without the editor's zoom.
  const zoom =
    first && pages.firstElementChild instanceof HTMLElement
      ? first.width / pages.firstElementChild.offsetWidth || 1
      : 1;
  return {
    width: first ? first.width / zoom / PX_PER_INCH : 8.27,
    height: first ? first.height / zoom / PX_PER_INCH : 11.69,
  };
}

/** Each sheet as a table, with its column widths, bold and fills. */
async function sheetTables(area: HTMLElement, xlsx: Uint8Array) {
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(xlsx.buffer as ArrayBuffer);
  for (const sheet of book.worksheets) {
    if (!sheet.actualRowCount) continue;
    const section = document.createElement("section");
    const title = document.createElement("h2");
    title.textContent = sheet.name;
    const table = document.createElement("table");
    const columns = sheet.columnCount;
    const colgroup = document.createElement("colgroup");
    for (let c = 1; c <= columns; c++) {
      const col = document.createElement("col");
      col.style.width = `${Math.round((sheet.getColumn(c).width ?? 10) * 7)}px`;
      colgroup.append(col);
    }
    table.append(colgroup);
    // Merged cells span their columns once; the cells they cover aren't drawn.
    const spans = new Map<string, { rows: number; cols: number }>();
    const covered = new Set<string>();
    for (const range of (sheet.model as { merges?: string[] }).merges ?? []) {
      const [from, to] = range.split(":");
      if (!from || !to) continue;
      const a = sheet.getCell(from);
      const z = sheet.getCell(to);
      const rows = Number(z.row) - Number(a.row) + 1;
      const cols = Number(z.col) - Number(a.col) + 1;
      spans.set(a.address, { rows, cols });
      for (let r = Number(a.row); r <= Number(z.row); r++)
        for (let c = Number(a.col); c <= Number(z.col); c++)
          if (r !== Number(a.row) || c !== Number(a.col)) covered.add(`${r}:${c}`);
    }
    // Up to the last row with something in it: a sheet's empty rows below aren't printed.
    let last = 0;
    sheet.eachRow((row, n) => {
      if (
        row.values &&
        (row.values as unknown[]).some((v) => v !== null && v !== undefined && v !== "")
      )
        last = n;
    });
    for (let r = 1; r <= last; r++) {
      const row = sheet.getRow(r);
      const tr = document.createElement("tr");
      for (let c = 1; c <= columns; c++) {
        if (covered.has(`${r}:${c}`)) continue;
        const cell = row.getCell(c);
        const td = document.createElement("td");
        const span = spans.get(cell.address);
        if (span) {
          td.colSpan = span.cols;
          td.rowSpan = span.rows;
        }
        td.textContent = cell.text;
        if (cell.font?.bold) td.style.fontWeight = "700";
        const fill = cell.fill as { fgColor?: { argb?: string } } | undefined;
        if (fill?.fgColor?.argb) td.style.background = `#${fill.fgColor.argb.slice(-6)}`;
        // Numbers, typed or worked out by a formula, sit to the right as in a spreadsheet.
        if (/^[-+]?[d,]*.?d+%?$/.test(cell.text.trim())) td.style.textAlign = "right";
        tr.append(td);
      }
      table.append(tr);
    }
    section.append(title, table);
    area.append(section);
  }
}

export async function saveAsPdf(file: OfficeFile, editor: OfficeEditor | null): Promise<void> {
  if (!editor) return;
  let target = file.path;
  if (!target) {
    const picked = await save({
      defaultPath: `${fileStem(file.name)}.pdf`,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (!picked) return;
    target = picked;
  }
  const area = printArea();
  const root = document.documentElement;
  try {
    let size = { width: 8.27, height: 11.69 };
    if (file.kind === "word") size = wordPages(area);
    else {
      const xlsx = await editor.fileBytes("print.xlsx");
      if (!xlsx) throw new Error("The spreadsheet couldn't be read.");
      await sheetTables(area, xlsx);
    }
    root.dataset.printing = file.kind;
    // Let the copy lay out before WebView2 prints it.
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const pdf = await invoke<ArrayBuffer>("print_to_pdf", {
      width: size.width,
      height: size.height,
    });
    const name = `${fileStem(target)}.pdf`;
    await deliver(target, [{ name, bytes: new Uint8Array(pdf) }], "");
  } catch (e) {
    showError(e instanceof Error ? e.message : "The PDF couldn't be made.");
  } finally {
    delete root.dataset.printing;
    area.remove();
  }
}
