import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import { useApp } from "../../appStore";
import { OFFICE_EXTENSIONS } from "../../lib/office";

/** The file picker. Uses the system dialog, so the user chooses exactly what Penwork can read. */
export async function pickFile(): Promise<string | null> {
  const path = await open({
    multiple: false,
    directory: false,
    filters: [
      { name: "Files Penwork opens", extensions: ["pwpptx", ...OFFICE_EXTENSIONS] },
      { name: "Penwork presentations", extensions: ["pwpptx"] },
      { name: "Word documents", extensions: ["docx"] },
      { name: "Spreadsheets", extensions: ["xlsx", "csv"] },
      { name: "PDF", extensions: ["pdf"] },
    ],
  });
  return typeof path === "string" ? path : null;
}

/**
 * Every way a file arrives except the button: double-click or Open with (at launch, or handed
 * over by a second launch) and drag-and-drop. Returns whether a file is being dragged over.
 */
export function useFileOpening(): boolean {
  const openPath = useApp((s) => s.openPath);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    const handle = (path: string) => void openPath(path);
    void invoke<string | null>("take_pending_open").then((path) => {
      if (path) handle(path);
    });
    const unlistenOpen = listen<string>("open-file", (e) => handle(e.payload));
    const unlistenDrop = getCurrentWebview().onDragDropEvent((e) => {
      const { type } = e.payload;
      if (type === "enter" || type === "over") setDragging(true);
      else setDragging(false);
      if (e.payload.type === "drop" && e.payload.paths[0]) handle(e.payload.paths[0]);
    });
    return () => {
      void unlistenOpen.then((stop) => stop());
      void unlistenDrop.then((stop) => stop());
    };
  }, [openPath]);

  return dragging;
}
