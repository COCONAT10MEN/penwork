import { describe, expect, it } from "vitest";
import { REDUCED_MOTION_FADE, SPRING_SPECS, springs, transitionFor } from "./motion";

// The "→ motion damping" column of the motion table in docs/DESIGN.md.
const DESIGN_DAMPING = {
  spatialFast: 34,
  spatialDefault: 31,
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
