import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useReduceMotion, useSpring } from "../../theme/motion";
import { IconButton, Surface } from "../../ui";
import { marginSelect } from "./marginSelect";
import { selectedPieces, selectionBounds } from "./selectionBoxes";
import type { TextStyle } from "./textStyles";
import styles from "./PdfTools.module.css";

/**
 * Text selected on a page gets a small bar just above it: bold, italic, underline, strike
 * through, monospace, copy. It rises in from the text and settles without a bounce, as Material's
 * popovers do.
 */

const BUTTONS: [TextStyle, string, string][] = [
  ["bold", "format_bold", "Bold"],
  ["italic", "format_italic", "Italic"],
  ["underline", "format_underlined", "Underline"],
  ["strike", "format_strikethrough", "Strikethrough"],
  ["mono", "code", "Monospace"],
];

const BAR_HEIGHT = 52;
const GAP = 10;

export function SelectionMarks({
  frame,
  canStyle,
  onStyle,
}: {
  frame: HTMLIFrameElement;
  /** Settings ▸ Editing is on; off, only Copy is offered. */
  canStyle: boolean;
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
    let later = 0;
    const measure = () => {
      const bounds = down ? null : selectionBounds(selectedPieces(doc));
      if (!bounds) return setAt(null);
      // Above the first line; below the last when there's no room above, under the bar.
      const below = bounds.top - BAR_HEIGHT - GAP < 72;
      const x = Math.max(160, Math.min(innerWidth - 160, bounds.middle));
      setAt({ x, y: below ? bounds.bottom + GAP : bounds.top - BAR_HEIGHT - GAP, below });
    };
    // Measured once the page has laid the selection out, not while it's still being made.
    const look = () => {
      cancelAnimationFrame(later);
      later = requestAnimationFrame(measure);
    };
    const onDown = () => {
      down = true;
      setAt(null);
    };
    // A press can end without a pointerup (a drag, or the system taking the pointer over).
    const onUp = () => {
      down = false;
      look();
    };
    const scroller = doc.getElementById("scroller");
    doc.addEventListener("selectionchange", look);
    doc.addEventListener("pointerdown", onDown, true);
    doc.addEventListener("pointerup", onUp, true);
    doc.addEventListener("pointercancel", onUp, true);
    doc.addEventListener("dragend", onUp, true);
    scroller?.addEventListener("scroll", look, { passive: true });
    // Pressed beside the words, the selection starts at the nearest one (not while drawing).
    const page = frame.contentWindow as { __pwDoc?: { state: () => { annot: boolean } } } | null;
    const stopMargin = marginSelect(doc, () => !!page?.__pwDoc?.state().annot);
    return () => {
      stopMargin();
      cancelAnimationFrame(later);
      doc.removeEventListener("selectionchange", look);
      doc.removeEventListener("pointerdown", onDown, true);
      doc.removeEventListener("pointerup", onUp, true);
      doc.removeEventListener("pointercancel", onUp, true);
      doc.removeEventListener("dragend", onUp, true);
      scroller?.removeEventListener("scroll", look);
    };
  }, [doc, frame]);

  if (!doc) return null;
  const done = () => {
    doc.getSelection()?.removeAllRanges();
    setAt(null);
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
            {canStyle &&
              BUTTONS.map(([kind, icon, label]) => (
                <IconButton
                  key={kind}
                  icon={icon}
                  label={label}
                  onClick={() => {
                    onStyle(kind);
                    done();
                  }}
                />
              ))}
            {canStyle && <span className={styles.selectionDivider} />}
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
