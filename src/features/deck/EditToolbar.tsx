import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useSpring } from "../../theme/motion";
import { IconButton, Surface } from "../../ui";
import styles from "./DeckView.module.css";

/**
 * Google's floating toolbar: the slide's own tools under the slide. Scrolling down the slide list
 * shrinks it to the slide count, and scrolling up, hovering or clicking brings the tools back.
 */
export function EditToolbar({
  slide,
  total,
  steps,
  shrunk,
  hint,
  canHide,
  canRemove,
  onGo,
  onDuplicate,
  onHide,
  onRemove,
  onOpen,
}: {
  slide: number;
  total: number;
  steps: number;
  shrunk: boolean;
  hint?: string;
  canHide: boolean;
  canRemove: boolean;
  onGo: (slide: number) => void;
  onDuplicate: () => void;
  onHide: () => void;
  onRemove: () => void;
  onOpen: () => void;
}) {
  const spring = useSpring("spatialFast");
  const fade = useSpring("effectsFast");
  // Shrinking can't overshoot past nothing, so it settles without a bounce.
  const settle = useSpring("effectsDefault");
  const [hover, setHover] = useState(false);
  const open = !shrunk || hover;
  const reveal = {
    initial: { width: 0, opacity: 0 },
    animate: { width: "auto", opacity: 1, transition: { default: spring, opacity: fade } },
    exit: { width: 0, opacity: 0, transition: { default: settle, opacity: fade } },
  };
  return (
    <Surface
      material="glass"
      floating
      className={styles.status}
      role="toolbar"
      aria-label="Slide tools"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onFocus={onOpen}
    >
      <AnimatePresence initial={false}>
        {open && (
          <motion.span key="before" className={styles.statusTools} {...reveal}>
            <IconButton
              icon="chevron_left"
              label="Previous slide"
              disabled={slide === 0}
              onClick={() => onGo(slide - 1)}
            />
          </motion.span>
        )}
      </AnimatePresence>
      <span className={styles.statusText} role="status">
        <span>
          <b>Slide {slide + 1}</b> of {total}
        </span>
        {steps > 0 && <span>{steps === 1 ? "1 step" : `${steps} steps`}</span>}
        {hint && <span>{hint}</span>}
      </span>
      <AnimatePresence initial={false}>
        {open && (
          <motion.span key="after" className={styles.statusTools} {...reveal}>
            <IconButton
              icon="chevron_right"
              label="Next slide"
              disabled={slide >= total - 1}
              onClick={() => onGo(slide + 1)}
            />
            <span className={styles.statusLine} aria-hidden="true" />
            <IconButton icon="content_copy" label="Duplicate slide" onClick={onDuplicate} />
            <IconButton
              icon="visibility_off"
              label="Hide or show slide"
              disabled={!canHide}
              onClick={onHide}
            />
            <IconButton
              icon="delete"
              label="Delete slide"
              disabled={!canRemove}
              onClick={onRemove}
            />
          </motion.span>
        )}
      </AnimatePresence>
    </Surface>
  );
}
