import { AnimatePresence, motion } from "motion/react";
import type { PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import { useEffect, useState } from "react";
import type { Mark } from "../../lib/pdftools/markup";
import { useReduceMotion, useSpring } from "../../theme/motion";
import { IconButton, Surface } from "../../ui";
import { selectedPieces, selectionBounds, selectionMarks } from "./selectionBoxes";
import styles from "./PdfTools.module.css";

/**
 * Text selected on a page gets a small bar just above it: bold, italic, underline, strike
 * through, copy. It rises in from the text and settles without a bounce, as Material's popovers do.
 */

export type TextStyle = "bold" | "italic";

const BAR_HEIGHT = 52;
const GAP = 10;

export function SelectionMarks({
  frame,
  viewer,
  onMark,
  onStyle,
}: {
  frame: HTMLIFrameElement;
  viewer: PDFViewer;
  onMark: (marks: Mark[]) => void;
  onStyle: (style: TextStyle) => void;
}) {
  const doc = frame.contentDocument;
  const [at, setAt] = useState<{ x: number; y: number; below: boolean } | null>(null);
  const reduce = useReduceMotion();
  const fade = useSpring("effectsFast");
  const rise = useSpring("spatialFast");

  useEffect(() => {
    if (!doc) return;
    let down = false;
    const look = () => {
      const bounds = down ? null : selectionBounds(selectedPieces(doc));
      if (!bounds) return setAt(null);
      // Above the first line; below the last when there's no room above, under the bar.
      const below = bounds.top - BAR_HEIGHT - GAP < 72;
      const x = Math.max(120, Math.min(innerWidth - 120, bounds.middle));
      setAt({ x, y: below ? bounds.bottom + GAP : bounds.top - BAR_HEIGHT - GAP, below });
    };
    const onDown = () => {
      down = true;
      setAt(null);
    };
    const onUp = () => {
      down = false;
      setTimeout(look, 0);
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
  }, [doc]);

  if (!doc) return null;
  const done = () => {
    doc.getSelection()?.removeAllRanges();
    setAt(null);
  };
  const mark = (kind: "underline" | "strike") => {
    const marks = selectionMarks(doc, viewer, kind);
    if (marks.length) onMark(marks);
    done();
  };
  // Settles without overshoot: a popover never bounces.
  const settle =
    "stiffness" in rise && rise.stiffness
      ? { ...rise, damping: 2 * Math.sqrt(rise.stiffness) }
      : rise;

  return (
    <AnimatePresence>
      {at && (
        <motion.div
          key="bar"
          className={styles.selectionPlace}
          style={{ left: at.x, top: at.y, transformOrigin: at.below ? "50% 0%" : "50% 100%" }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.86, y: at.below ? -8 : 8 }}
          animate={{ opacity: 1, scale: 1, y: 0, transition: { default: settle, opacity: fade } }}
          exit={{ opacity: 0, scale: reduce ? 1 : 0.92, transition: fade }}
        >
          <Surface material="glass" strength="thick" floating className={styles.selectionBar}>
            <IconButton
              icon="format_bold"
              label="Bold"
              onClick={() => {
                onStyle("bold");
                done();
              }}
            />
            <IconButton
              icon="format_italic"
              label="Italic"
              onClick={() => {
                onStyle("italic");
                done();
              }}
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
            <span className={styles.selectionDivider} />
            <IconButton
              icon="content_copy"
              label="Copy"
              onClick={() => {
                void navigator.clipboard.writeText(doc.getSelection()?.toString() ?? "");
                setAt(null);
              }}
            />
          </Surface>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
