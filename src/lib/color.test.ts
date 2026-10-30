import { describe, expect, it } from "vitest";
import { hexToHsv, hsvToHex, mixHex, normalizeHex, rgba } from "./color";

describe("hsv", () => {
  it("converts known colors", () => {
    expect(hexToHsv("#ff0000")).toEqual({ h: 0, s: 1, v: 1 });
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe("#00ff00");
    expect(hsvToHex({ h: 240, s: 1, v: 0.5 })).toBe("#000080");
  });

  it("round-trips the template's colors", () => {
    for (const hex of [
      "#e5352b",
      "#1f6fe5",
      "#10222b",
      "#35aac5",
      "#ffe14a",
      "#ffffff",
      "#000000",
    ]) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    }
  });

  it("keeps black and gray hue-less", () => {
    expect(hexToHsv("#000000").s).toBe(0);
    expect(hexToHsv("#808080").s).toBe(0);
  });
});

describe("mixHex", () => {
  it("mixes by amount", () => {
    expect(mixHex("#000000", "#ffffff", 0)).toBe("#000000");
    expect(mixHex("#000000", "#ffffff", 1)).toBe("#ffffff");
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
  });
});

describe("rgba", () => {
  it("writes modern CSS syntax", () => {
    expect(rgba("#102030", 0.5)).toBe("rgb(16 32 48 / 0.5)");
  });
});

describe("normalizeHex", () => {
  it("accepts common spellings", () => {
    expect(normalizeHex("#ABCDEF")).toBe("#abcdef");
    expect(normalizeHex("abc")).toBe("#aabbcc");
    expect(normalizeHex(" #123456 ")).toBe("#123456");
  });

  it("rejects anything else", () => {
    expect(normalizeHex("#12345")).toBeNull();
    expect(normalizeHex("red")).toBeNull();
    expect(normalizeHex("")).toBeNull();
  });
});
