import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useApp } from "../../appStore";
import { fileName, fileStem, officeKind, saveBody, siblingPath } from "../../lib/office";
import { notify } from "../notices/notices";

/** Files in and out of the tools: what they're given, and what they make. */

export interface Picked {
  name: string;
  path: string;
  bytes: Uint8Array;
}

const FILTERS = {
  pdf: [{ name: "PDF", extensions: ["pdf"] }],
  image: [{ name: "Pictures", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] }],
};

export async function pickFiles(kind: keyof typeof FILTERS, multiple: boolean): Promise<Picked[]> {
  const chosen = await open({ multiple, directory: false, filters: FILTERS[kind] });
  const paths = chosen === null ? [] : Array.isArray(chosen) ? chosen : [chosen];
  const out: Picked[] = [];
  for (const path of paths) {
    const data = await invoke<ArrayBuffer>("read_input_file", { path });
    out.push({ name: fileName(path), path, bytes: new Uint8Array(data) });
  }
  return out;
}

/** Writes a new file; if the name is taken, the next free one ("name (2).pdf"). */
export async function writeNew(path: string, bytes: Uint8Array): Promise<string> {
  return invoke<string>("write_new_file", saveBody(path, bytes));
}

/** Where a file made from `source` goes: beside it, named after it. */
export function besides(source: string, suffix: string, extension: string): string {
  return siblingPath(source, `${fileStem(source)}${suffix}.${extension}`);
}

/**
 * Writes what a tool made beside the original: one file as it is, several in a new folder. The
 * notice offers to open it (when Penwork opens that kind) or show it in Explorer.
 */
export async function deliver(
  source: string,
  files: { name: string; bytes: Uint8Array }[],
  folderLabel: string,
): Promise<string[]> {
  if (files.length === 0) {
    notify("There was nothing to make.", "info");
    return [];
  }
  let written: string[];
  const [one] = files;
  if (files.length === 1 && one) {
    written = [await writeNew(siblingPath(source, one.name), one.bytes)];
  } else {
    const parent = siblingPath(source, "").replace(/[\\/]$/, "");
    const folder = await invoke<string>("make_folder", {
      parent,
      name: `${fileStem(source)} ${folderLabel}`,
    });
    written = [];
    for (const f of files) written.push(await writeNew(`${folder}\\${f.name}`, f.bytes));
  }
  const first = written[0] ?? source;
  const opens = files.length === 1 && officeKind(first) !== null;
  notify(
    files.length === 1
      ? `Saved as "${fileName(first)}".`
      : `${files.length} files saved in a new folder.`,
    "check_circle",
    [
      ...(opens ? [{ label: "Open", run: () => void useApp.getState().openPath(first) }] : []),
      { label: "Show in folder", run: () => void invoke("show_in_folder", { path: first }) },
    ],
  );
  return written;
}
