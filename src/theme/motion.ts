import { type Transition, useReducedMotionConfig } from "motion/react";

/** Material's expressive motion scheme, as damping ratio + stiffness (docs/DESIGN.md). */
export const SPRING_SPECS = {
  spatialFast: { ratio: 0.6, stiffness: 800 }, // buttons, toggles, shape morph
  spatialDefault: { ratio: 0.8, stiffness: 380 }, // toolbars, FAB menu, popovers, sheets
  spatialSlow: { ratio: 0.8, stiffness: 200 }, // full-screen transitions
  effectsFast: { ratio: 1, stiffness: 3800 }, // color/opacity on press
  effectsDefault: { ratio: 1, stiffness: 1600 }, // fades
  effectsSlow: { ratio: 1, stiffness: 800 }, // large fades
} as const;

export type SpringName = keyof typeof SPRING_SPECS;

/** Motion uses physical damping; with mass 1, damping = ratio × 2 × √stiffness. */
export function springTransition({
  ratio,
  stiffness,
}: {
  ratio: number;
  stiffness: number;
}): Transition {
  return { type: "spring", stiffness, damping: ratio * 2 * Math.sqrt(stiffness), mass: 1 };
}

export const springs = Object.fromEntries(
  Object.entries(SPRING_SPECS).map(([name, spec]) => [name, springTransition(spec)]),
) as Record<SpringName, Transition>;

/** What spatial springs become when the user asks for less motion. */
export const REDUCED_MOTION_FADE: Transition = { type: "tween", duration: 0.15, ease: "linear" };

export function isSpatial(name: SpringName): boolean {
  return name.startsWith("spatial");
}

/** Pick a transition, honoring reduced motion. Effects (color/opacity) don't move, so they stay. */
export function transitionFor(name: SpringName, reduceMotion: boolean): Transition {
  return reduceMotion && isSpatial(name) ? REDUCED_MOTION_FADE : springs[name];
}

/**
 * Hook form of transitionFor. Follows Windows' "Animation effects" setting, and the app's own
 * setting once Settings wraps the app in <MotionConfig reducedMotion="always">.
 */
export function useSpring(name: SpringName): Transition {
  return transitionFor(name, useReducedMotionConfig() ?? false);
}

/** True when moving things should fade instead (for components that animate layout or shape). */
export function useReduceMotion(): boolean {
  return useReducedMotionConfig() ?? false;
}
