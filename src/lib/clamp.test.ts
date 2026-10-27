import { describe, expect, it } from "vitest";
import { clamp } from "./clamp";

describe("clamp", () => {
  it("leaves values inside the range alone", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("pulls values back to the nearest edge", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });

  it("rejects an upside-down range", () => {
    expect(() => clamp(1, 10, 0)).toThrow(RangeError);
  });
});
