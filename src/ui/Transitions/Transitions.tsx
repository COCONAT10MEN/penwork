import { AnimatePresence, motion, type Variants } from "motion/react";
import { useState, type ReactNode } from "react";
import { fadeTiming, useReduceMotion, useSpring } from "../../theme/motion";
import styles from "./Transitions.module.css";

/**
 * Material's two page transitions, from material-components-android. The old page is gone by 35%
 * of the way through and the new one only starts appearing then, so the two are never seen on top
 * of each other. That's the "through" in fade through, and why pages don't look doubled.
 */
const THRESHOLD = 0.35;
const LONG_1 = 0.45; // motionDurationLong1, in seconds
const SLIDE = 30; // MaterialSharedAxis's slide distance
const START_SCALE = 0.92; // MaterialFadeThrough's DEFAULT_START_SCALE
// A spring settles sooner than Material's curve. Started with the fade, it would finish before the
// new page can be seen, so it waits for most of the old page to go.
const MOVE_WAIT = 0.12;

function useFades() {
  const fadeOut = { duration: fadeTiming(LONG_1 * THRESHOLD), ease: "linear" } as const;
  const fadeIn = {
    duration: fadeTiming(LONG_1 * (1 - THRESHOLD)),
    delay: fadeTiming(LONG_1 * THRESHOLD),
    ease: "linear",
  } as const;
  return { fadeOut, fadeIn };
}

/** For destinations with no relation to each other: rail pages, and Home to an open file. */
export function FadeThrough({
  id,
  grow = true,
  initial = true,
  className,
  children,
}: {
  id: string;
  /** Off for an editor: the libraries measure their tools as they mount. */
  grow?: boolean;
  initial?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReduceMotion();
  const spatial = useSpring("spatialDefault");
  const { fadeOut, fadeIn } = useFades();
  const grown = { ...spatial, delay: fadeTiming(MOVE_WAIT) };
  const scales = grow && !reduce;
  return (
    <AnimatePresence mode="popLayout" initial={initial}>
      <motion.div
        key={id}
        className={className}
        initial={{ opacity: 0, scale: scales ? START_SCALE : 1 }}
        animate={{ opacity: 1, scale: 1, transition: { opacity: fadeIn, scale: grown } }}
        exit={{ opacity: 0, transition: fadeOut }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

const SLIDING: Variants = {
  enter: (way: number) => ({ opacity: 0, x: way * SLIDE }),
  show: { opacity: 1, x: 0 },
  leave: (way: number) => ({ opacity: 0, x: way * -SLIDE }),
};

/** For tabs, which sit side by side: the page moves the way the tabs are going. */
export function SharedAxis({
  id,
  order,
  label,
  children,
}: {
  id: string;
  /** Every tab's id, left to right. */
  order: string[];
  label?: string;
  children: ReactNode;
}) {
  const reduce = useReduceMotion();
  const spatial = useSpring("spatialDefault");
  const { fadeOut, fadeIn } = useFades();
  const moved = { ...spatial, delay: fadeTiming(MOVE_WAIT) };
  const [last, setLast] = useState({ id, way: 1 });
  if (last.id !== id) setLast({ id, way: order.indexOf(id) >= order.indexOf(last.id) ? 1 : -1 });
  const way = reduce ? 0 : last.way;
  return (
    <div className={styles.axis}>
      <AnimatePresence mode="popLayout" initial={false} custom={way}>
        <motion.div
          key={id}
          role="tabpanel"
          aria-label={label}
          custom={way}
          variants={SLIDING}
          initial="enter"
          animate={{ opacity: 1, x: 0, transition: { opacity: fadeIn, x: moved } }}
          exit={{ opacity: 0, x: way * -SLIDE, transition: { opacity: fadeOut, x: spatial } }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
