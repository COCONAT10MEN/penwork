import { describe, expect, it } from "vitest";
import { isSelected, nextSelection } from "./selection";

describe("nextSelection", () => {
  it("single-select always picks the clicked value", () => {
    expect(nextSelection("a", "b")).toBe("b");
    expect(nextSelection("a", "a")).toBe("a");
  });

  it("multi-select toggles values", () => {
    expect(nextSelection(["a"], "b")).toEqual(["a", "b"]);
    expect(nextSelection(["a", "b"], "a")).toEqual(["b"]);
  });

  it("required multi-select keeps the last value", () => {
    expect(nextSelection(["a"], "a", true)).toEqual(["a"]);
    expect(nextSelection(["a"], "a", false)).toEqual([]);
  });
});

describe("isSelected", () => {
  it("works for single and multi values", () => {
    expect(isSelected("a", "a")).toBe(true);
    expect(isSelected(["a", "b"], "b")).toBe(true);
    expect(isSelected(["a"], "c")).toBe(false);
  });
});
