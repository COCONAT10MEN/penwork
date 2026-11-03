import { describe, expect, it } from "vitest";
import { outlinePath, toPoints, toUnits, UNITS_ACROSS, type PageView } from "./pdfInk";

/** A letter page as pdf.js's viewport sees it at scale 1, upright or turned a quarter. */
function view(rotation: 0 | 90): PageView {
  const [W, H] = [612, 792];
  if (rotation === 0) {
    return {
      width: W,
      convertToPdfPoint: (x, y) => [x, H - y],
      convertToViewportPoint: (x, y) => [x, H - y],
    };
  }
  return {
    width: H,
    convertToPdfPoint: (x, y) => [y, x],
    convertToViewportPoint: (x, y) => [y, x],
  };
}

const stroke = {
  k: "p" as const,
  c: "#000000",
  w: 8,
  pts: [
    [0, 0, 0.5],
    [UNITS_ACROSS, 400, 0.5],
  ] as [number, number, number][],
};

describe("page units and PDF points", () => {
  it("puts the top-left corner at the top of the page, as PDF counts from the bottom", () => {
    const points = toPoints(stroke, view(0));
    expect(points.pts[0]).toEqual([0, 792, 0.5]);
    expect(points.pts[1]?.[0]).toBeCloseTo(612);
  });

  it("scales the width with the page", () => {
    expect(toPoints(stroke, view(0)).w).toBeCloseTo((8 * 612) / UNITS_ACROSS);
  });

  it("comes back to the same units, upright or turned", () => {
    for (const r of [0, 90] as const) {
      const back = toUnits(toPoints(stroke, view(r)), view(r));
      back.pts.forEach((p, i) => {
        expect(p[0]).toBeCloseTo(stroke.pts[i]?.[0] ?? 0, 0);
        expect(p[1]).toBeCloseTo(stroke.pts[i]?.[1] ?? 0, 0);
      });
      expect(back.w).toBeCloseTo(8, 1);
    }
  });
});

describe("outlinePath", () => {
  it("is a closed, filled path of cubic curves", () => {
    const path = outlinePath([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]);
    expect(path.startsWith("0 0 m")).toBe(true);
    expect(path.endsWith("h f")).toBe(true);
    expect(path.split(" c").length - 1).toBe(3);
  });
});
