import type { Variants } from "motion/react";
import { useReduceMotion, useSpring } from "../../theme/motion";

/**
 * How one tool arrives when a group of them comes into the bar: up and in, a moment after the one
 * before it (the group sets that moment). It leaves sideways and shrinking, the way it was pushed.
 */
export function useToolArrival(): Variants {
  const reduce = useReduceMotion();
  const rise = useSpring("spatialDefault");
  const fade = useSpring("effectsFast");
  return {
    out: { opacity: 0, y: reduce ? 0 : 12, scale: reduce ? 1 : 0.85 },
    in: { opacity: 1, x: 0, y: 0, scale: 1, transition: { default: rise, opacity: fade } },
    gone: {
      opacity: 0,
      x: reduce ? 0 : -14,
      scale: reduce ? 1 : 0.8,
      transition: { default: rise, opacity: fade },
    },
  };
}
