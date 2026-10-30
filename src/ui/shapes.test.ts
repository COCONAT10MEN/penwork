import { describe, expect, it } from "vitest";
import { CIRCLE_PATH, CLOVER_PATH, COOKIE_PATH, wavyCirclePath, wavyLinePath } from "./shapes";

const numbers = (d: string) => d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];

describe("shapes", () => {
  it("all have the same point count, so they can morph", () => {
    const counts = [COOKIE_PATH, CLOVER_PATH, CIRCLE_PATH].map((d) => numbers(d).length);
    expect(new Set(counts).size).toBe(1);
  });

  it("stay inside the 100×100 box", () => {
    for (const d of [COOKIE_PATH, CLOVER_PATH, CIRCLE_PATH]) {
      for (const n of numbers(d)) {
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(100);
      }
    }
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
