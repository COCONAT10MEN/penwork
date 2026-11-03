import { invoke } from "@tauri-apps/api/core";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useApp } from "../../appStore";
import { fileName, siblingPath } from "../../lib/office";
import { AmbientBackground, LoadingIndicator } from "../../ui";
import { useLeaveGuard } from "../deck/useLeaveGuard";
import { notify, showError } from "../notices/notices";
import { EditorBoundary } from "./EditorBoundary";
import { OfficeBar } from "./OfficeBar";
import { saveAsPdf } from "./saveAsPdf";
import { useOfficeThumb } from "./useOfficeThumb";
import { pickSavePath, writeOfficeFile, type OfficeEditor, type OfficeFile } from "./officeFile";
import "./office-theme.css";
import styles from "./OfficeView.module.css";

// Each editor is large, and most sessions never need more than one of them, if any.
const EDITORS = {
  word: lazy(() => import("./WordEditor")),
  sheet: lazy(() => import("./SheetEditor")),
  pdf: lazy(() => import("./PdfEditor")),
};

// Long enough for the "Saved" notice to have gone, or it ends up in the picture.
const AFTER_SAVE_MS = 3500;

/** Tells the editors exactly where the bar's free space is, so their tools can sit in it. */
function useSlotPlace() {
  const view = useRef<HTMLDivElement>(null);
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const box = view.current;
    if (!slot || !box) return;
    const place = () => {
      box.style.setProperty("--pw-slot-left", `${slot.offsetLeft + 10}px`);
      box.style.setProperty("--pw-slot-width", `${slot.offsetWidth}px`);
    };
    const watcher = new ResizeObserver(place);
    watcher.observe(slot);
    return () => watcher.disconnect();
  }, [slot]);
  return { view, slot, setSlot };
}

export function OfficeView({ file }: { file: OfficeFile }) {
  const closeOffice = useApp((s) => s.closeOffice);
  const officeSaved = useApp((s) => s.officeSaved);
  const officeNamed = useApp((s) => s.officeNamed);
  const editor = useRef<OfficeEditor | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [menusOpen, setMenusOpen] = useState(false);
  const [barHidden, setBarHidden] = useState(false);
  const [barGlass, setBarGlass] = useState(false);
  const { view, slot, setSlot } = useSlotPlace();
  const takeThumb = useOfficeThumb(file.kind, file.path);
  const Editor = EDITORS[file.kind];

  const writeTo = async (path: string) => {
    if (!editor.current) return false;
    setSaving(true);
    try {
      const bytes = await editor.current.fileBytes(path);
      if (!bytes) throw new Error("no file");
      await writeOfficeFile(path, bytes);
      editor.current.saved();
      officeSaved(file, path);
      takeThumb(AFTER_SAVE_MS);
      setDirty(false);
      notify("Saved");
      return true;
    } catch {
      showError(
        "This file couldn't be saved. If it's open in another app, close it and try again.",
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveAs = async () => {
    const path = await pickSavePath(file);
    return path ? writeTo(path) : false;
  };
  const save = async () => (file.path ? writeTo(file.path) : saveAs());

  const rename = async (name: string) => {
    if (!file.path) {
      officeNamed(file, name);
      return;
    }
    const to = siblingPath(file.path, name);
    try {
      await invoke("rename_office_file", { from: file.path, to });
      officeSaved(file, to);
    } catch (error) {
      showError(
        error === "taken"
          ? `There's already a file called "${name}" in this folder. Pick another name.`
          : "This file couldn't be renamed. If it's open in another app, close it and try again.",
      );
    }
  };

  const guard = useLeaveGuard({ dirty, title: file.name, save, discard: async () => {} });

  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        void saveRef.current();
      }
    };
    // Capture: the editors treat Ctrl+S as their own otherwise.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const status = saving
    ? "Saving…"
    : dirty
      ? "Unsaved changes"
      : file.path
        ? "All changes saved"
        : "Not saved yet";
  return (
    <div ref={view} className={styles.view} data-menus={menusOpen || undefined}>
      <AmbientBackground />
      <OfficeBar
        name={file.path ? fileName(file.path) : file.name}
        status={status}
        dirty={dirty}
        hasMenus={file.kind === "word"}
        docked={file.kind === "pdf"}
        hidden={barHidden}
        seeThrough={barGlass}
        menusOpen={menusOpen}
        slotRef={setSlot}
        onBack={() => void guard().then((go) => go && closeOffice())}
        onRename={rename}
        onMenus={() => setMenusOpen((open) => !open)}
        onSave={() => void save()}
        onSaveAs={() => void saveAs()}
        onSaveAsPdf={file.kind === "pdf" ? undefined : () => void saveAsPdf(file, editor.current)}
      />
      <Suspense
        fallback={
          <div className={styles.loading}>
            <LoadingIndicator label="Opening" size={48} />
          </div>
        }
      >
        <EditorBoundary name={file.name}>
          <Editor
            file={file}
            handleRef={editor}
            toolsSlot={slot}
            onChange={() => setDirty(true)}
            onSave={() => void saveRef.current()}
            onBarHidden={setBarHidden}
            onBarGlass={setBarGlass}
          />
        </EditorBoundary>
      </Suspense>
    </div>
  );
}
