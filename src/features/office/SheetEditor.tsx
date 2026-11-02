import { transformExcelToFortune, transformFortuneToExcel } from "@corbe30/fortune-excel";
import type { Sheet } from "@fortune-sheet/core";
import { Workbook, type WorkbookInstance } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { fileExtension, parseCsv, writeCsv } from "../../lib/office";
import { LoadingIndicator } from "../../ui";
import { showError } from "../notices/notices";
import type { OfficeEditorProps, OfficeFile } from "./officeFile";
import styles from "./OfficeView.module.css";

const NUMBER = /^-?\d+(\.\d+)?(e[-+]?\d+)?$/i;
const BLANK: Sheet[] = [{ name: "Sheet1", celldata: [], order: 0, status: 1 }];

/** Without a starting selection the name box reads "A1:NaN" and the toolbar stays greyed out. */
function withSelection(sheet: Sheet): Sheet {
  return { ...sheet, luckysheet_select_save: [{ row: [0, 0], column: [0, 0] }] };
}

/**
 * The library reads numbers from a file as text and writes them back that way, which would break
 * every sum in Excel. Text such as "007" is marked as text in the file, so it isn't touched.
 */
function withNumbers(sheet: Sheet): Sheet {
  const data = sheet.data?.map((row) =>
    row.map((cell) => {
      const type = cell?.ct?.t;
      const plain = !cell?.qp && (type === undefined || type === "g" || type === "n");
      const number = typeof cell?.v === "string" && NUMBER.test(cell.v);
      return cell && plain && number ? { ...cell, v: Number(cell.v) } : cell;
    }),
  );
  return { ...sheet, data };
}

/** The library's own CSV reading splits on every comma, even those inside a quoted cell. */
function csvSheet(text: string): Sheet {
  const celldata = parseCsv(text).flatMap((row, r) =>
    row.flatMap((value, c) => {
      if (value === "") return [];
      const number = NUMBER.test(value) ? Number(value) : null;
      return [
        {
          r,
          c,
          v: {
            v: number ?? value,
            m: value,
            ct: { fa: "General", t: number === null ? "s" : "n" },
            ff: 1,
          },
        },
      ];
    }),
  );
  return { name: "Sheet1", celldata, order: 0, status: 1 };
}

function cellText(cell: { m?: string | number | null; v?: unknown } | null | undefined): string {
  const value = cell?.m ?? cell?.v;
  return value === null || value === undefined ? "" : String(value);
}

function sheetRows(sheet: Sheet): string[][] {
  const rows = (sheet.data ?? []).map((row) => row.map(cellText));
  const filled = rows.map((row) => {
    let end = row.length;
    while (end > 0 && row[end - 1] === "") end--;
    return row.slice(0, end);
  });
  while (filled.length > 0 && filled[filled.length - 1]?.length === 0) filled.pop();
  return filled;
}

/** A new file and a CSV are ready at once. An Excel file is read after the first render. */
function firstSheets(file: OfficeFile): Sheet[] | null {
  if (!file.bytes) return BLANK.map(withSelection);
  if (fileExtension(file.name) !== "csv") return null;
  return [withSelection(csvSheet(new TextDecoder().decode(file.bytes)))];
}

/** The icons have dark colours written into them, and CSS can't reach inside an SVG `<use>`. */
function themeIcons(box: HTMLElement): boolean {
  if (!box.querySelector("symbol")) return false;
  for (const name of ["fill", "stroke"]) {
    for (const part of box.querySelectorAll(`symbol [${name}]:not([${name}="none"])`)) {
      part.setAttribute(name, "currentColor");
    }
  }
  return true;
}

export default function SheetEditor({ file, handleRef, onChange }: OfficeEditorProps) {
  const workbook = useRef<WorkbookInstance>(null);
  const [sheets, setSheets] = useState(() => firstSheets(file));
  const [version, setVersion] = useState(0);
  // Opening a file resizes rows and columns, which looks the same as an edit.
  const settled = useRef(false);
  const box = useRef<HTMLDivElement>(null);
  const changed = useRef(onChange);
  useEffect(() => {
    changed.current = onChange;
  });
  // The library reports a change whenever this function is a new one, so it has to stay the same.
  const report = useCallback(() => {
    if (settled.current) changed.current();
  }, []);

  useEffect(() => {
    if (!file.bytes || sheets) return;
    const source = new File([file.bytes as Uint8Array<ArrayBuffer>], file.name);
    // The library's last step sizes rows through this ref before the sheets exist, which throws.
    // Sizes are in the sheet data too, so it gets an empty one.
    const show = (list: Sheet[]) => setSheets(list.map(withSelection));
    transformExcelToFortune(source, show, setVersion, { current: null }).catch(() =>
      showError("This spreadsheet couldn't be read."),
    );
  }, [file, sheets]);

  useEffect(() => {
    const element = box.current;
    if (!element || themeIcons(element)) return;
    // The library adds the icons a moment after it first renders.
    const watcher = new MutationObserver(() => {
      if (themeIcons(element)) watcher.disconnect();
    });
    watcher.observe(element, { childList: true, subtree: true });
    return () => watcher.disconnect();
  }, [sheets, version]);

  useEffect(() => {
    if (!sheets) return;
    const timer = setTimeout(() => (settled.current = true), 600);
    return () => clearTimeout(timer);
  }, [sheets, version]);

  useEffect(() => {
    handleRef.current = {
      fileBytes: async (path) => {
        if (fileExtension(path) === "csv") {
          const first = workbook.current?.getAllSheets()[0];
          return first ? new TextEncoder().encode(writeCsv(sheetRows(first))) : null;
        }
        const sheets = { getAllSheets: () => workbook.current?.getAllSheets().map(withNumbers) };
        const blob = await transformFortuneToExcel({ current: sheets }, undefined, false);
        return new Uint8Array(await blob.arrayBuffer());
      },
      saved: () => {},
    };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef]);

  if (!sheets) {
    return (
      <div className={styles.loading}>
        <LoadingIndicator label="Opening" size={48} />
      </div>
    );
  }
  return (
    <div ref={box} className={styles.sheet}>
      <Workbook key={version} ref={workbook} data={sheets} lang="en" onChange={report} />
    </div>
  );
}
