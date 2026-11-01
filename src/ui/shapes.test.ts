import { describe, expect, it } from "vitest";
import { morphBetween, shapePath, wavyCirclePath, wavyLinePath, type ShapeName } from "./shapes";

const numbers = (d: string) => d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];

describe("shapes", () => {
  it("stay inside the 100×100 box", () => {
    for (const name of ["Cookie9Sided", "Clover4Leaf", "Flower", "Sunny"] as ShapeName[]) {
      for (const n of numbers(shapePath(name))) {
        expect(n).toBeGreaterThanOrEqual(-3);
        expect(n).toBeLessThanOrEqual(103);
      }
    }
  });

  it("morph from one shape to the other", () => {
    const at = morphBetween("Cookie9Sided", "Flower");
    expect(numbers(at(0)).length).toBe(numbers(at(1)).length);
    expect(at(0)).not.toBe(at(1));
  });
});

describe("wavy paths", () => {
  it("line reaches the requested width", () => {
    const d = wavyLinePath(100, 20, 3, 6);
    expect(numbers(d).at(-2)).toBeGreaterThanOrEqual(100);
    expect(d.startsWith("M0 6")).toBe(true);
  });

  it("circle stays within radius plus amplitude", () => {
    const pts = numbers(wavyCirclePath(20, 2, 9, 24));
    expect(Math.max(...pts)).toBeLessThanOrEqual(46);
    expect(Math.min(...pts)).toBeGreaterThanOrEqual(2);
  });
});
