import { describe, expect, it } from "vitest";
import { rgbToHex } from "../lib/color";
import { contrastRatio, hexToRgb } from "../lib/contrast";
import {
  DEFAULT_SEED,
  ROLE_NAMES,
  GLASS_ALPHA,
  GLASS_SHEEN,
  generateColors,
  glassBase,
  glassVars,
  themeCss,
  type SchemeVariant,
} from "./theme";

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

  it("falls back to Penwork's teal for an invalid seed", () => {
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

/** Paints `top` at `alpha` over `under`, as the browser does. */
function over(under: string, top: string, alpha: number): string {
  const u = hexToRgb(under);
  const t = hexToRgb(top);
  const mix = (i: 0 | 1 | 2) => u[i] + (t[i] - u[i]) * alpha;
  return rgbToHex(mix(0), mix(1), mix(2));
}

describe("text on glass, over the app's own background", () => {
  const seeds = ["#00687A", "#3F5BD4", "#0078D4", "#2E7D32", "#C2410C", "#FBD64A", "#6B7280"];
  for (const seed of seeds) {
    it(`reaches 4.5:1 over the background and its soft colours (${seed})`, () => {
      const { light, dark } = generateColors(seed);
      for (const [scheme, colors] of [
        ["light", light],
        ["dark", dark],
      ] as const) {
        const { from, to } = glassBase(colors, scheme);
        const sheen = GLASS_SHEEN[scheme];
        const surface = colors.surface ?? "";
        const glows = ["ambient-a", "ambient-b", "ambient-c"] as const;
        const behinds = [surface, ...glows.map((g) => over(surface, colors[g] ?? "", 0.3))];
        for (const strength of ["thin", "regular", "thick"] as const) {
          const [a, b] = GLASS_ALPHA[scheme][strength];
          for (const behind of behinds) {
            for (const [glass, alpha] of [
              [from, a],
              [to, b],
            ] as const) {
              const painted = over(over(behind, glass, alpha), "#ffffff", sheen);
              const label = `${seed} ${scheme} ${strength} over ${behind}`;
              expect(
                contrastRatio(colors["on-surface"] ?? "", painted),
                label,
              ).toBeGreaterThanOrEqual(4.5);
            }
          }
        }
      }
    });
  }
});

describe("glassVars", () => {
  it("gives light and dark their own rims and shadows", () => {
    const { light, dark } = generateColors(DEFAULT_SEED);
    expect(glassVars(light, "light").rim).not.toBe(glassVars(dark, "dark").rim);
    expect(glassVars(light, "light").shadow).not.toBe(glassVars(dark, "dark").shadow);
  });

  it("makes fills stronger from thin to thick, and solid fully opaque", () => {
    const g = glassVars(generateColors(DEFAULT_SEED).dark, "dark");
    expect(g["thin-fill"]).toContain(`/ ${GLASS_ALPHA.dark.thin[0]}`);
    expect(g["regular-fill"]).toContain(`/ ${GLASS_ALPHA.dark.regular[0]}`);
    expect(g["thick-fill"]).toContain(`/ ${GLASS_ALPHA.dark.thick[0]}`);
    expect(g["solid-fill"]).not.toContain("/");
  });

  it("is emitted for every scheme, so forced panels get their own glass", () => {
    const css = themeCss(generateColors(DEFAULT_SEED));
    expect(css.match(/--pw-glass-regular-fill:/g)).toHaveLength(3);
  });
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
