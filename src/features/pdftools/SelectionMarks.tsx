import type { PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import { useEffect, useReducer, useState } from "react";
import type { Mark, MarkKind } from "../../lib/pdftools/markup";
import { selectionMarks } from "./selectionBoxes";

const WORDS: Record<MarkKind, string> = {
  highlight: "highlight",
  underline: "underline",
  strike: "strike through",
};

import { Button, IconButton, Surface } from "../../ui";
import styles from "./PdfTools.module.css";

/**
 * Text selected on a page gets a small bar over it: highlight, underline, strike through, copy.
 * When one of those was picked in the ⋮ menu first ("armed"), the next selection is marked at once.
 */

export function SelectionMarks({
  frame,
  viewer,
  armed,
  onArmed,
  onMark,
}: {
  frame: HTMLIFrameElement;
  viewer: PDFViewer;
  /** Picked in the ⋮ menu: the next selection gets this. */
  armed: MarkKind | null;
  onArmed: (kind: MarkKind | null) => void;
  onMark: (marks: Mark[]) => void;
}) {
  const doc = frame.contentDocument;
  const [box, setBox] = useState<DOMRect | null>(null);
  const [, redraw] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!doc) return;
    let down = false;
    const look = () => {
      const sel = doc.getSelection();
      const inText =
        sel && !sel.isCollapsed && sel.anchorNode?.parentElement?.closest(".textLayer");
      setBox(inText && !down ? sel.getRangeAt(0).getBoundingClientRect() : null);
    };
    const onDown = () => {
      down = true;
      setBox(null);
    };
    const onUp = () => {
      down = false;
      // A moment for the selection to settle after the button comes up.
      setTimeout(() => {
        look();
        if (armed) {
          const marks = selectionMarks(doc, viewer, armed);
          if (marks.length) {
            onMark(marks);
            doc.getSelection()?.removeAllRanges();
          }
        }
      }, 0);
    };
    const scroller = doc.getElementById("scroller");
    doc.addEventListener("selectionchange", look);
    doc.addEventListener("pointerdown", onDown, true);
    doc.addEventListener("pointerup", onUp, true);
    scroller?.addEventListener("scroll", look, { passive: true });
    return () => {
      doc.removeEventListener("selectionchange", look);
      doc.removeEventListener("pointerdown", onDown, true);
      doc.removeEventListener("pointerup", onUp, true);
      scroller?.removeEventListener("scroll", look);
    };
  }, [doc, viewer, armed, onMark]);

  useEffect(() => {
    if (!armed) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onArmed(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [armed, onArmed]);

  if (!doc) return null;
  const mark = (kind: MarkKind) => {
    const marks = selectionMarks(doc, viewer, kind);
    if (!marks.length) return;
    onMark(marks);
    doc.getSelection()?.removeAllRanges();
    setBox(null);
    redraw();
  };

  return (
    <>
      {box && !armed && (
        <Surface
          material="glass"
          strength="thick"
          floating
          className={styles.selectionBar}
          style={{ left: box.left + box.width / 2, top: Math.max(72, box.top - 56) }}
        >
          <IconButton
            icon="format_ink_highlighter"
            label="Highlight"
            onClick={() => mark("highlight")}
          />
          <IconButton
            icon="format_underlined"
            label="Underline"
            onClick={() => mark("underline")}
          />
          <IconButton
            icon="format_strikethrough"
            label="Strikethrough"
            onClick={() => mark("strike")}
          />
          <IconButton
            icon="content_copy"
            label="Copy"
            onClick={() => {
              void navigator.clipboard.writeText(doc.getSelection()?.toString() ?? "");
              setBox(null);
            }}
          />
        </Surface>
      )}
      {armed && (
        <Surface material="glass" strength="thick" floating className={styles.placeBar}>
          <span className={styles.placeHint}>
            Select the text to {WORDS[armed]}. Each selection is marked as you let go.
          </span>
          <Button size="small" onClick={() => onArmed(null)}>
            Done
          </Button>
        </Surface>
      )}
    </>
  );
}
