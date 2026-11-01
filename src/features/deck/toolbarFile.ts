import { invoke, isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

/** The dock's settings (toolbar.json). The page checks every value itself when it loads them. */

const MAX_BYTES = 256 * 1024;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

export async function loadToolbar(): Promise<Record<string, unknown> | null> {
  if (!isTauri()) return null;
  const text = await invoke<string | null>("read_app_file", { name: "toolbar.json" }).catch(
    () => null,
  );
  if (!text) return null;
  try {
    const data: unknown = JSON.parse(text);
    return typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function saveToolbar(settings: Record<string, unknown>): void {
  if (!isTauri()) return;
  const text = JSON.stringify(settings, null, 2);
  if (text.length > MAX_BYTES) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void invoke("write_app_file", { name: "toolbar.json", text });
  }, 300);
}

/** The template's "toolbar-settings.json", so files can move between it and Penwork. */
export async function exportToolbar(text: string): Promise<void> {
  const path = await save({
    defaultPath: "toolbar-settings.json",
    filters: [{ name: "Toolbar settings", extensions: ["json"] }],
  });
  if (path) await invoke("export_toolbar", { path, text });
}

export async function importToolbar(apply: (text: string) => void): Promise<void> {
  const path = await open({
    multiple: false,
    directory: false,
    filters: [{ name: "Toolbar settings", extensions: ["json"] }],
  });
  if (typeof path !== "string") return;
  apply(await invoke<string>("read_toolbar_file", { path }).catch(() => ""));
}
