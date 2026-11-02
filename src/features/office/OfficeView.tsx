import { motion } from "motion/react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useApp } from "../../appStore";
import { fileName } from "../../lib/office";
import { useSpring } from "../../theme/motion";
import { IconButton, LoadingIndicator, Surface } from "../../ui";
import { useLeaveGuard } from "../deck/useLeaveGuard";
import { notify, showError } from "../notices/notices";
import { EditorBoundary } from "./EditorBoundary";
import { pickSavePath, writeOfficeFile, type OfficeEditor, type OfficeFile } from "./officeFile";
import styles from "./OfficeView.module.css";

// Each editor is large, and most sessions never need more than one of them, if any.
const EDITORS = {
  word: lazy(() => import("./WordEditor")),
  sheet: lazy(() => import("./SheetEditor")),
  pdf: lazy(() => import("./PdfEditor")),
};

export function OfficeView({ file }: { file: OfficeFile }) {
  const closeOffice = useApp((s) => s.closeOffice);
  const officeSaved = useApp((s) => s.officeSaved);
  const editor = useRef<OfficeEditor | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const fade = useSpring("effectsDefault");
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
    <motion.div
      className={styles.view}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: fade }}
    >
      <Surface material="glass" floating className={styles.header}>
        <IconButton
          icon="arrow_back"
          label="Back to Home"
          onClick={() => void guard().then((go) => go && closeOffice())}
        />
        <div className={styles.titles}>
          <h1 className={styles.title} title={file.path ?? undefined}>
            {file.path ? fileName(file.path) : file.name}
          </h1>
          <p className={styles.status} data-dirty={dirty || undefined}>
            {status}
          </p>
        </div>
        <div className={styles.actions} role="group" aria-label="File actions" data-press-group>
          <IconButton size="compact" icon="save" label="Save" onClick={() => void save()} />
          <IconButton size="compact" icon="save_as" label="Save as" onClick={() => void saveAs()} />
        </div>
      </Surface>
      <div className={styles.body}>
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
              onChange={() => setDirty(true)}
              onSave={() => void saveRef.current()}
            />
          </EditorBoundary>
        </Suspense>
      </div>
    </motion.div>
  );
}
