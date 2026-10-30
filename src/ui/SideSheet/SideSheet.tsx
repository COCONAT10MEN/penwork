import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { useReduceMotion, useSpring } from "../../theme/motion";
import { cx } from "../cx";
import { IconButton } from "../IconButton/IconButton";
import { surfaceClass, type SurfaceMaterial } from "../Surface/Surface";
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
  children,
}: SideSheetProps) {
  const spring = useSpring("spatialCalm");
  const fade = useSpring("effectsFast");
  const reduce = useReduceMotion();
  const offset = side === "right" ? 32 : -32;
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          aria-label={title}
          className={cx(
            styles.sheet,
            material === "tonal" && styles.tonal,
            surfaceClass({ material, floating: true }),
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
