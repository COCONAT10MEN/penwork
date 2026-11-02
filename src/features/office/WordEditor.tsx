import { DocxEditor, type DocxEditorRef } from "@docx-editor.dev/react";
import "@docx-editor.dev/react/styles.css";
import { useEffect, useRef } from "react";
import { useApp } from "../../appStore";
import { pickFile } from "../deck/useFileOpening";
import { useResolvedTheme } from "./useResolvedTheme";
import type { OfficeEditorProps } from "./officeFile";
import styles from "./OfficeView.module.css";

export default function WordEditor({ file, handleRef, onChange, onSave }: OfficeEditorProps) {
  const editor = useRef<DocxEditorRef>(null);
  const theme = useResolvedTheme();
  const openPath = useApp((s) => s.openPath);

  useEffect(() => {
    handleRef.current = {
      fileBytes: async () => {
        const saved = await editor.current?.save();
        return saved ? new Uint8Array(saved) : null;
      },
      saved: () => {},
    };
    return () => {
      handleRef.current = null;
    };
  }, [handleRef]);

  return (
    <div className={styles.word}>
      <DocxEditor
        ref={editor}
        document={file.bytes ?? "blank"}
        mode="edit"
        title={file.name}
        colorMode={theme}
        menu={{ reportIssue: false }}
        onSave={onSave}
        onOpen={() => void pickFile().then((path) => (path ? openPath(path) : undefined))}
        onChange={(change) => {
          // Opening a file reports itself as a change too.
          if (!change.source) onChange();
        }}
      />
    </div>
  );
}
