import { describe, expect, it } from "vitest";
import { hasInk, readInk, readStrokes, writeInk } from "./ink";

const stroke = { k: "p", c: "#e5352b", w: 8, op: 1, np: false, pts: [[10, 20, 0.5]] };

describe("ink", () => {
  it("round-trips", () => {
    const ink = { "s-1": readStrokes([stroke]), wb: readStrokes([stroke]) };
    expect(readInk(JSON.parse(writeInk(ink)))).toEqual(ink);
  });

  it("drops bad strokes and keeps good ones", () => {
    const bad = [
      null,
      "x",
      { ...stroke, k: "z" },
      { ...stroke, c: "red" },
      { ...stroke, c: "url(x)" },
      { ...stroke, w: -1 },
      { ...stroke, w: 9999 },
      { ...stroke, pts: [] },
      { ...stroke, pts: [["a", 1]] },
      { ...stroke, pts: [[1, Infinity]] },
    ];
    expect(readStrokes([...bad, stroke])).toHaveLength(1);
  });

  it("fills in what older strokes left out", () => {
    expect(readStrokes([{ k: "h", c: "#ffe14a", w: 38, pts: [[1, 2]] }])[0]).toMatchObject({
      op: 1,
      np: false,
      pts: [[1, 2, 0.5]],
    });
  });

  it("survives a damaged file", () => {
    expect(readInk(null)).toEqual({});
    expect(readInk({ slides: 5 })).toEqual({});
    expect(readInk({ slides: { "s-1": "nope" } })).toEqual({});
  });

  it("knows when there is nothing", () => {
    expect(hasInk({})).toBe(false);
    expect(hasInk({ "s-1": [] })).toBe(false);
    expect(hasInk({ "s-1": readStrokes([stroke]) })).toBe(true);
  });
});
