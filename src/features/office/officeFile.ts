import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { fileExtension, fileName, officeKind, saveBody, type OfficeKind } from "../../lib/office";

export interface OfficeFile {
  /** A new one each time a file opens, so its screen starts clean. */
  id: string;
  /** Null until a new file is first saved. */
  path: string | null;
  name: string;
  kind: OfficeKind;
  /** Null for a new, empty file. */
  bytes: Uint8Array | null;
}

/** What an editor gives the screen around it. */
export interface OfficeEditor {
  /** The whole file as it should now be written to `path`. Null if it can't be made. */
  fileBytes: (path: string) => Promise<Uint8Array | null>;
  /** The file reached the disk, so what's on screen is what's saved. */
  saved: () => void;
}

export interface OfficeEditorProps {
  file: OfficeFile;
  handleRef: { current: OfficeEditor | null };
  /** The free part of the top bar, for an editor whose tools are ours to place. */
  toolsSlot: HTMLElement | null;
  onChange: () => void;
  onSave: () => void;
}

export async function openOfficeFile(path: string): Promise<OfficeFile> {
  const kind = officeKind(path);
  if (!kind) throw new Error("not a document");
  const data = await invoke<ArrayBuffer>("read_office_file", { path });
  return {
    id: crypto.randomUUID(),
    path,
    name: fileName(path),
    kind,
    bytes: new Uint8Array(data),
  };
}

export function newOfficeFile(kind: "word" | "sheet"): OfficeFile {
  const name = kind === "word" ? "Untitled document.docx" : "Untitled spreadsheet.xlsx";
  return { id: crypto.randomUUID(), path: null, name, kind, bytes: null };
}

export async function writeOfficeFile(path: string, file: Uint8Array): Promise<void> {
  await invoke("save_office_file", saveBody(path, file));
}

const SAVE_FILTERS: Record<OfficeKind, { name: string; extensions: string[] }[]> = {
  word: [{ name: "Word document", extensions: ["docx"] }],
  sheet: [
    { name: "Excel workbook", extensions: ["xlsx"] },
    { name: "CSV (first sheet only)", extensions: ["csv"] },
  ],
  pdf: [{ name: "PDF", extensions: ["pdf"] }],
};

/** The list starts with the file's own type, so Save as doesn't quietly change it. */
export async function pickSavePath(file: OfficeFile): Promise<string | null> {
  const own = fileExtension(file.name);
  const filters = [...SAVE_FILTERS[file.kind]].sort(
    (a, b) => Number(b.extensions.includes(own)) - Number(a.extensions.includes(own)),
  );
  return save({ defaultPath: file.path ?? file.name, filters });
}
