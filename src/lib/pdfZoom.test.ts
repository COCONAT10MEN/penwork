import { describe, expect, it } from "vitest";
import { fitScale, MAX_SCALE, MIN_SCALE, wheelZoom, zoomLabel } from "./pdfZoom";

const letter = { width: 612, height: 792 };

describe("fitScale", () => {
  it("fills the width exactly", () => {
    const scale = fitScale("width", { width: 1000, height: 600 }, letter);
    expect(scale * letter.width * (96 / 72)).toBeCloseTo(1000);
  });

  it("fits the whole page by whichever side runs out first", () => {
    const scale = fitScale("page", { width: 1000, height: 600 }, letter);
    expect(scale * letter.height * (96 / 72)).toBeCloseTo(600);
  });

  it("shares the width between two pages side by side", () => {
    const one = fitScale("width", { width: 1000, height: 600 }, letter);
    const two = fitScale("width", { width: 1000, height: 600 }, letter, { across: 2, gap: 10 });
    expect(two * letter.width * (96 / 72) * 2 + 10).toBeCloseTo(1000);
    expect(two).toBeLessThan(one);
  });

  it("stays within the limits", () => {
    expect(fitScale("width", { width: 10, height: 10 }, letter)).toBe(MIN_SCALE);
    expect(fitScale("width", { width: 1e6, height: 1e6 }, letter)).toBe(MAX_SCALE);
  });
});

describe("wheelZoom", () => {
  it("treats a touchpad pinch as a smooth factor", () => {
    const zoom = wheelZoom(-3.5, 0);
    expect("factor" in zoom && zoom.factor).toBeGreaterThan(1);
    const out = wheelZoom(4.25, 0);
    expect("factor" in out && out.factor).toBeLessThan(1);
  });

  it("treats a mouse wheel notch as one step", () => {
    expect(wheelZoom(-100, 0)).toEqual({ steps: 1 });
    expect(wheelZoom(100, 0)).toEqual({ steps: -1 });
    expect(wheelZoom(3, 1)).toEqual({ steps: -1 });
  });
});

describe("zoomLabel", () => {
  it("rounds to a whole percent", () => {
    expect(zoomLabel(1.2345)).toBe("123%");
  });
});
