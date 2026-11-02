import { AnimatePresence, motion } from "motion/react";
import { useApp } from "../../appStore";
import { useReduceMotion, useSpring } from "../../theme/motion";
import styles from "./ShowLaunch.module.css";

/**
 * Present from Home. The presentation still has to open, so the card's picture grows to fill the
 * window straight away and stands in for the slide until the real one is ready behind it.
 */
export function ShowLaunch() {
  const launch = useApp((s) => s.launch);
  const grow = useSpring("spatialDefault");
  const fade = useSpring("effectsDefault");
  const reduce = useReduceMotion();
  return (
    <AnimatePresence>
      {launch && (
        <motion.div
          className={styles.scrim}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: fade }}
          exit={{ opacity: 0, transition: fade }}
        >
          <motion.div
            className={styles.picture}
            style={launch.url ? { backgroundImage: `url(${launch.url})` } : undefined}
            initial={
              reduce
                ? false
                : {
                    left: launch.rect.left,
                    top: launch.rect.top,
                    width: launch.rect.width,
                    height: launch.rect.height,
                    borderRadius: 18,
                  }
            }
            animate={{ left: 0, top: 0, width: "100%", height: "100%", borderRadius: 0 }}
            transition={grow}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
