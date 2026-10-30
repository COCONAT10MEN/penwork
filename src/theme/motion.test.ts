import { describe, expect, it } from "vitest";
import {
  REDUCED_MOTION_FADE,
  SPRING_SPECS,
  motionCss,
  springEasing,
  springPosition,
  springs,
  transitionFor,
} from "./motion";

function easingPoints(easing: string): number[] {
  return easing
    .replace(/^linear\(|\)$/g, "")
    .split(", ")
    .map(Number);
}

describe("springEasing", () => {
  it("starts at 0 and ends exactly at 1", () => {
    const pts = easingPoints(springEasing(SPRING_SPECS.spatialFast).easing);
    expect(pts[0]).toBe(0);
    expect(pts.at(-1)).toBe(1);
  });

  it("overshoots for spatial springs and never for effects springs", () => {
    expect(
      Math.max(...easingPoints(springEasing(SPRING_SPECS.spatialFast).easing)),
    ).toBeGreaterThan(1);
    expect(
      Math.max(...easingPoints(springEasing(SPRING_SPECS.effectsDefault).easing)),
    ).toBeLessThanOrEqual(1);
  });

  it("settles in a sensible time", () => {
    const { durationMs } = springEasing(SPRING_SPECS.spatialDefault);
    expect(durationMs).toBeGreaterThan(200);
    expect(durationMs).toBeLessThan(1000);
  });

  it("springPosition reaches the target", () => {
    expect(springPosition(0.8, 380, 2)).toBeCloseTo(1, 3);
    expect(springPosition(1, 1600, 0)).toBe(0);
  });
});

describe("motionCss", () => {
  it("emits duration and easing for every preset, and zeroes spatial ones when reduced", () => {
    const css = motionCss();
    expect(css).toContain("--md-sys-motion-spatial-fast-easing: linear(");
    expect(css).toContain("--md-sys-motion-effects-slow-duration:");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain(":root[data-reduce-motion]");
  });
});

// The "→ motion damping" column of the motion table in docs/DESIGN.md.
const DESIGN_DAMPING = {
  spatialFast: 34,
  spatialDefault: 31,
  spatialCalm: 39,
  spatialSlow: 23,
  effectsFast: 123,
  effectsDefault: 80,
  effectsSlow: 57,
} as const;

describe("springs", () => {
  it("match the damping values in DESIGN.md", () => {
    for (const [name, expected] of Object.entries(DESIGN_DAMPING)) {
      const t = springs[name as keyof typeof springs] as { damping: number; stiffness: number };
      expect(Math.round(t.damping), name).toBe(expected);
      expect(t.stiffness).toBe(SPRING_SPECS[name as keyof typeof SPRING_SPECS].stiffness);
    }
  });

  it("effects springs are critically damped (never overshoot)", () => {
    for (const name of ["effectsFast", "effectsDefault", "effectsSlow"] as const) {
      expect(SPRING_SPECS[name].ratio).toBe(1);
    }
  });
});

describe("transitionFor", () => {
  it("swaps spatial springs for a short fade when motion is reduced", () => {
    expect(transitionFor("spatialDefault", true)).toBe(REDUCED_MOTION_FADE);
    expect(transitionFor("spatialDefault", false)).toBe(springs.spatialDefault);
  });

  it("keeps effects springs when motion is reduced", () => {
    expect(transitionFor("effectsFast", true)).toBe(springs.effectsFast);
  });
});
