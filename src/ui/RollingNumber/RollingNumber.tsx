import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useReduceMotion, useSpring } from "../../theme/motion";
import styles from "./RollingNumber.module.css";

/**
 * A number whose digits roll to the next value, like a counter: up when it grows, down when it
 * shrinks. Only the digits that change move. Screen readers get the plain text.
 */
export function RollingNumber({ value, className }: { value: string; className?: string }) {
  const reduce = useReduceMotion();
  const roll = useSpring("spatialDefault");
  const fade = useSpring("effectsFast");
  const [last, setLast] = useState({ value, way: 1 });
  if (last.value !== value) {
    const grew = (parseFloat(value) || 0) >= (parseFloat(last.value) || 0);
    setLast({ value, way: grew ? 1 : -1 });
  }
  const way = reduce ? 0 : last.way;
  // Counted from the right, so 99 to 100 adds a digit on the left instead of moving them all.
  const chars = [...value].reverse();
  return (
    <span className={className ? `${styles.number} ${className}` : styles.number}>
      <span className={styles.hidden}>{value}</span>
      <span aria-hidden="true" className={styles.row}>
        {chars
          .map((char, place) => (
            <span key={place} className={styles.place}>
              <AnimatePresence mode="popLayout" initial={false} custom={way}>
                <motion.span
                  key={char}
                  className={styles.char}
                  initial={{ y: `${way * 80}%`, opacity: 0 }}
                  animate={{ y: "0%", opacity: 1, transition: { y: roll, opacity: fade } }}
                  exit={{ y: `${way * -80}%`, opacity: 0, transition: { y: roll, opacity: fade } }}
                >
                  {char}
                </motion.span>
              </AnimatePresence>
            </span>
          ))
          .reverse()}
      </span>
    </span>
  );
}
