import { type Transition, useReducedMotionConfig } from "motion/react";

/** Material's expressive motion scheme, as damping ratio + stiffness (docs/DESIGN.md). */
export const SPRING_SPECS = {
  spatialFast: { ratio: 0.6, stiffness: 800 }, // buttons, toggles, shape morph
  spatialDefault: { ratio: 0.8, stiffness: 380 }, // morphs that may overshoot a little
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

/** Slower or quicker than Google's own timing, from Settings. 1 is exactly theirs. */
let timeScale = 1;
export function setTimeScale(scale: number): void {
  timeScale = scale;
}

/** A fade's length in seconds, following the animation speed setting. */
export function fadeTiming(seconds: number): number {
  return seconds * timeScale;
}

/** A spring stretched in time keeps its shape: stiffness over k², damping over k. */
function scaled(spec: Transition): Transition {
  if (timeScale === 1 || !("stiffness" in spec) || !spec.stiffness || !spec.damping) return spec;
  const stiffness = spec.stiffness / timeScale ** 2;
  return { ...spec, stiffness, damping: spec.damping / timeScale };
}

/** What spatial springs become when the user asks for less motion. */
export const REDUCED_MOTION_FADE: Transition = { type: "tween", duration: 0.15, ease: "linear" };

export function isSpatial(name: SpringName): boolean {
  return name.startsWith("spatial");
}

/** Pick a transition, honoring reduced motion. Effects (color/opacity) don't move, so they stay. */
export function transitionFor(name: SpringName, reduceMotion: boolean): Transition {
  return reduceMotion && isSpatial(name) ? REDUCED_MOTION_FADE : scaled(springs[name]);
}

/**
 * Hook form of transitionFor. App.tsx sets <MotionConfig reducedMotion="user">, which follows
 * Windows' "Animation effects"; the Reduce motion setting will switch that to "always".
 */
export function useSpring(name: SpringName): Transition {
  return transitionFor(name, useReducedMotionConfig() ?? false);
}

/** True when moving things should fade instead (for components that animate layout or shape). */
export function useReduceMotion(): boolean {
  return useReducedMotionConfig() ?? false;
}

/** Position of a unit spring released from 0 toward 1 (mass 1) at time t seconds. */
export function springPosition(ratio: number, stiffness: number, t: number): number {
  const w = Math.sqrt(stiffness);
  if (ratio >= 1) return 1 - Math.exp(-w * t) * (1 + w * t); // critically damped
  const wd = w * Math.sqrt(1 - ratio * ratio);
  return 1 - Math.exp(-ratio * w * t) * (Math.cos(wd * t) + ((ratio * w) / wd) * Math.sin(wd * t));
}

/**
 * The same spring as a CSS easing, so CSS-only components (shape morph, switch handle, rail
 * width) move exactly like the motion/react ones. Settles when within 0.1% of the target.
 */
export function springEasing(spec: { ratio: number; stiffness: number }): {
  durationMs: number;
  easing: string;
} {
  const step = 1 / 600;
  let settled = 0;
  for (let t = 0; t < 3; t += step) {
    if (Math.abs(1 - springPosition(spec.ratio, spec.stiffness, t)) > 0.001) settled = t;
  }
  const duration = settled + step;
  const samples = 40;
  const points: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const x =
      i === samples ? 1 : springPosition(spec.ratio, spec.stiffness, (duration * i) / samples);
    points.push(String(Math.round(x * 1000) / 1000));
  }
  return { durationMs: Math.round(duration * 1000), easing: `linear(${points.join(", ")})` };
}

export const SLOW = 1.5;
export const FAST = 0.7;

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

/**
 * CSS variables --md-sys-motion-<spring>-duration / -easing for every preset. Spatial durations
 * drop to 0 with reduced motion (OS setting, or data-reduce-motion on <html> from Settings).
 */
export function motionCss(): string {
  const vars: string[] = [];
  const reduced: string[] = [];
  const slow: string[] = [];
  const fast: string[] = [];
  for (const [name, spec] of Object.entries(SPRING_SPECS)) {
    const { durationMs, easing } = springEasing(spec);
    const key = `--md-sys-motion-${kebab(name)}`;
    vars.push(`  ${key}-duration: ${durationMs}ms;`, `  ${key}-easing: ${easing};`);
    slow.push(`  ${key}-duration: ${Math.round(durationMs * SLOW)}ms;`);
    fast.push(`  ${key}-duration: ${Math.round(durationMs * FAST)}ms;`);
    if (isSpatial(name as SpringName)) reduced.push(`  ${key}-duration: 0ms;`);
  }
  return [
    `:root {\n${vars.join("\n")}\n}`,
    `:root[data-motion-speed="slow"] {\n${slow.join("\n")}\n}`,
    `:root[data-motion-speed="fast"] {\n${fast.join("\n")}\n}`,
    `@media (prefers-reduced-motion: reduce) {\n:root {\n${reduced.join("\n")}\n}\n}`,
    `:root[data-reduce-motion] {\n${reduced.join("\n")}\n}`,
  ].join("\n\n");
}

export function applyMotionTokens(doc: Document = document): void {
  const style = doc.createElement("style");
  style.id = "pw-motion";
  style.textContent = motionCss();
  doc.getElementById("pw-motion")?.remove();
  doc.head.appendChild(style);
}
