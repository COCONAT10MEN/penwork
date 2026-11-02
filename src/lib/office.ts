/** Word, Excel and PDF files: what kind a path is, and how a CSV file reads and writes. */

export type OfficeKind = "word" | "sheet" | "pdf";

const KINDS: Record<string, OfficeKind> = {
  docx: "word",
  xlsx: "sheet",
  csv: "sheet",
  pdf: "pdf",
};

export const OFFICE_EXTENSIONS = Object.keys(KINDS);

export function fileExtension(path: string): string {
  return /\.([^.\\/]+)$/.exec(path)?.[1]?.toLowerCase() ?? "";
}

export function officeKind(path: string): OfficeKind | null {
  return KINDS[fileExtension(path)] ?? null;
}

export function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

/** The folder a file is in, for telling two files of the same name apart. */
export function fileFolder(path: string): string {
  return path.slice(0, path.length - fileName(path).length - 1);
}

/** Save needs the path and the file in one request: see `split_body` in office.rs. */
export function saveBody(path: string, file: Uint8Array): Uint8Array {
  const name = new TextEncoder().encode(path);
  const body = new Uint8Array(4 + name.length + file.length);
  new DataView(body.buffer).setUint32(0, name.length, true);
  body.set(name, 4);
  body.set(file, 4 + name.length);
  return body;
}

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

/** Commas, line breaks and doubled quotes inside quoted fields all stay part of the cell. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const source = text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && source[i + 1] === "\n") i++;
      rows.push([...row, cell]);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length > 0) rows.push([...row, cell]);
  return rows;
}

export function writeCsv(rows: string[][]): string {
  const field = (value: string) =>
    /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  return rows.map((row) => row.map(field).join(",")).join("\r\n") + "\r\n";
}
