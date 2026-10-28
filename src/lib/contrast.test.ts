import { describe, expect, it } from "vitest";
import { contrastRatio, hexToRgb } from "./contrast";

describe("contrastRatio", () => {
  it("matches the WCAG extremes", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("matches a known WCAG value", () => {
    // #767676 on white is the classic "just passes 4.5:1" gray.
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });

  it("does not care about order", () => {
    expect(contrastRatio("#3f5bd4", "#ffffff")).toBe(contrastRatio("#ffffff", "#3f5bd4"));
  });
});

describe("hexToRgb", () => {
  it("parses with or without #", () => {
    expect(hexToRgb("#3F5BD4")).toEqual([0x3f, 0x5b, 0xd4]);
    expect(hexToRgb("ffffff")).toEqual([255, 255, 255]);
  });

  it("rejects bad input", () => {
    expect(() => hexToRgb("#fff")).toThrow();
  });
});
