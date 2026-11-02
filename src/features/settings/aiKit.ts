import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { notify, showError } from "../notices/notices";

// Bundled as text, so the kit works offline and matches this version of the app.
const FILES = import.meta.glob("/authoring/**/*.{md,py,html,css,json}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** Makes a new folder with the kit in it. It never writes over anything already there. */
export async function saveAiKit(): Promise<void> {
  const folder = await open({ directory: true, multiple: false, title: "Where to put the AI kit" });
  if (typeof folder !== "string") return;
  const files = Object.entries(FILES).map(([path, text]) => [
    path.replace("/authoring/", ""),
    text,
  ]);
  try {
    const place = await invoke<string>("write_ai_kit", { folder, files });
    notify(`AI kit saved in ${place}`, "folder");
  } catch {
    showError("The AI kit couldn't be saved there.");
  }
}
