import { describe, expect, it } from "vitest";
import { splitParts } from "./pageToolValues";

describe("what Split makes", () => {
  it("one file a page, or equal parts with the rest in the last", () => {
    expect(splitParts({ how: "every", n: 3, ranges: [] }, 3)).toEqual([[1], [2], [3]]);
    expect(splitParts({ how: "n", n: 2, ranges: [] }, 5)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("ranges as picked, kept inside the PDF, either way round", () => {
    expect(
      splitParts(
        {
          how: "ranges",
          n: 2,
          ranges: [
            [1, 2],
            [5, 3],
            [9, 40],
          ],
        },
        10,
      ),
    ).toEqual([[1, 2], [3, 4, 5], [9, 10]]);
  });
});
