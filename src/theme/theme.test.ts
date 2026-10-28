import { describe, expect, it } from "vitest";
import { contrastRatio } from "../lib/contrast";
import { DEFAULT_SEED, ROLE_NAMES, generateColors, themeCss, type SchemeVariant } from "./theme";

const TEXT_PAIRS: [string, string][] = [
  ["on-primary", "primary"],
  ["on-primary-container", "primary-container"],
  ["on-secondary", "secondary"],
  ["on-secondary-container", "secondary-container"],
  ["on-tertiary", "tertiary"],
  ["on-tertiary-container", "tertiary-container"],
  ["on-error", "error"],
  ["on-error-container", "error-container"],
  ["on-surface", "surface"],
  ["on-surface", "surface-container-highest"],
  ["on-surface-variant", "surface"],
  ["on-surface-variant", "surface-container-highest"],
  ["inverse-on-surface", "inverse-surface"],
];

describe("generateColors", () => {
  it("produces every role as a hex color, for light and dark", () => {
    const { light, dark } = generateColors(DEFAULT_SEED);
    for (const scheme of [light, dark]) {
      expect(Object.keys(scheme)).toEqual(ROLE_NAMES);
      for (const hex of Object.values(scheme)) expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("is deterministic for the same seed", () => {
    expect(generateColors("#3F5BD4")).toEqual(generateColors("#3F5BD4"));
  });

  it("changes with the seed", () => {
    expect(generateColors("#3F5BD4").light.primary).not.toBe(
      generateColors("#2E7D32").light.primary,
    );
  });

  it("falls back to Ink blue for an invalid seed", () => {
    expect(generateColors("not a color")).toEqual(generateColors(DEFAULT_SEED));
  });

  const seeds = ["#3F5BD4", "#2E7D32", "#C2410C", "#FBD64A", "#6B7280"];
  const variants: SchemeVariant[] = ["tonalSpot", "vibrant", "expressive"];
  for (const variant of variants) {
    it(`keeps text pairs at 4.5:1 or better (${variant})`, () => {
      for (const seed of seeds) {
        const { light, dark } = generateColors(seed, variant);
        for (const [name, scheme] of [
          ["light", light],
          ["dark", dark],
        ] as const) {
          for (const [fg, bg] of TEXT_PAIRS) {
            const ratio = contrastRatio(scheme[fg] ?? "", scheme[bg] ?? "");
            expect(ratio, `${seed} ${name}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
          }
        }
      }
    });
  }
});

describe("themeCss", () => {
  it("emits light, dark, system and forced-panel rules", () => {
    const css = themeCss(generateColors(DEFAULT_SEED));
    expect(css).toContain("@media (prefers-color-scheme: dark)");
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain(".pw-theme-light");
    expect(css).toContain("--md-sys-color-primary:");
  });
});
