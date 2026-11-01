import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { useReduceMotion, useSpring } from "../../theme/motion";
import { cx } from "../cx";
import { IconButton } from "../IconButton/IconButton";
import { surfaceClass, type SurfaceMaterial, type SurfaceStrength } from "../Surface/Surface";
import styles from "./SideSheet.module.css";

export interface SideSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  side?: "left" | "right";
  /** Width in px. */
  width?: number;
  /** Extra buttons next to the close button. */
  actions?: ReactNode;
  material?: SurfaceMaterial;
  /** Use "thick" for lots of text, like the inspector. */
  strength?: SurfaceStrength;
  children: ReactNode;
}

/** A panel beside the content (sorter, inspector). Not modal: the page stays usable. */
export function SideSheet({
  open,
  onClose,
  title,
  side = "right",
  width = 320,
  actions,
  material = "tonal",
  strength = "regular",
  children,
}: SideSheetProps) {
  const spring = useSpring("spatialDefault");
  const fade = useSpring("effectsFast");
  const reduce = useReduceMotion();
  const offset = side === "right" ? 32 : -32;

  // Closing removes the focused element, so give focus back to whatever opened the sheet.
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      opener.current = document.activeElement as HTMLElement | null;
      return;
    }
    if (document.activeElement === document.body) opener.current?.focus();
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          aria-label={title}
          className={cx(
            styles.sheet,
            material === "tonal" && styles.tonal,
            surfaceClass({ material, strength, floating: true }),
          )}
          style={{ width }}
          initial={reduce ? { opacity: 0 } : { opacity: 0, x: offset }}
          animate={{ opacity: 1, x: 0, transition: spring }}
          exit={
            reduce
              ? { opacity: 0, transition: fade }
              : { opacity: 0, x: offset, transition: spring }
          }
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              onClose();
            }
          }}
        >
          <header className={styles.header}>
            <h2 className={styles.title}>{title}</h2>
            {actions}
            <IconButton icon="close" label={`Close ${title}`} onClick={onClose} />
          </header>
          <div className={styles.body}>{children}</div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
