// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  assetNames,
  insertAt,
  isHidden,
  joinSlides,
  moveSlides,
  nextSelection,
  nudgeSlides,
  removeSlides,
  renameAssets,
  splitSlides,
  toggleHidden,
  withNewId,
  wouldHide,
  type DeckSlide,
} from "./slideOps";

const slide = (id: string, body = ""): DeckSlide => ({
  id,
  html: `<section class="slide" data-id="${id}">${body}</section>`,
});
const abcd = ["a", "b", "c", "d"].map((id) => slide(id));
const ids = (list: readonly DeckSlide[]) => list.map((s) => s.id).join("");

describe("splitSlides", () => {
  it("round-trips with joinSlides", () => {
    const html = joinSlides(abcd);
    expect(ids(splitSlides(html))).toBe("abcd");
    expect(joinSlides(splitSlides(html))).toBe(html);
  });
});

describe("withNewId", () => {
  it("changes the id everywhere and nothing else", () => {
    const copy = withNewId(slide("a", "<p>Hi</p>"));
    expect(copy.id).not.toBe("a");
    expect(copy.html).toContain(`data-id="${copy.id}"`);
    expect(copy.html).toContain("<p>Hi</p>");
  });
});

describe("hiding", () => {
  it("hides, and shows again when all are hidden", () => {
    const hidden = toggleHidden(abcd, [1, 2]);
    expect(hidden.map(isHidden)).toEqual([false, true, true, false]);
    expect(toggleHidden(hidden, [1, 2]).map(isHidden)).toEqual([false, false, false, false]);
  });

  it("hides them all if only some are hidden", () => {
    const one = toggleHidden(abcd, [1]);
    expect(toggleHidden(one, [1, 2]).map(isHidden)).toEqual([false, true, true, false]);
  });

  it("leaves the original list alone, for undo", () => {
    toggleHidden(abcd, [0]);
    expect(isHidden(abcd[0] as DeckSlide)).toBe(false);
  });
});

describe("moveSlides", () => {
  it("moves one slide forward and back", () => {
    expect(ids(moveSlides(abcd, [0], 3).slides)).toBe("bcad");
    expect(ids(moveSlides(abcd, [3], 1).slides)).toBe("adbc");
  });

  it("moves to the very end", () => {
    const moved = moveSlides(abcd, [0], 4);
    expect(ids(moved.slides)).toBe("bcda");
    expect(moved.first).toBe(3);
  });

  it("keeps several slides together and in order", () => {
    const moved = moveSlides(abcd, [0, 2], 4);
    expect(ids(moved.slides)).toBe("bdac");
    expect(moved.first).toBe(2);
  });

  it("leaves the order alone when dropped where they are", () => {
    expect(ids(moveSlides(abcd, [1], 1).slides)).toBe("abcd");
    expect(ids(moveSlides(abcd, [1], 2).slides)).toBe("abcd");
  });
});

describe("nudgeSlides", () => {
  it("moves a block one place", () => {
    expect(ids(nudgeSlides(abcd, [1, 2], -1)?.slides ?? [])).toBe("bcad");
    expect(ids(nudgeSlides(abcd, [1, 2], 1)?.slides ?? [])).toBe("adbc");
  });

  it("stops at the ends", () => {
    expect(nudgeSlides(abcd, [0], -1)).toBeNull();
    expect(nudgeSlides(abcd, [3], 1)).toBeNull();
  });
});

describe("list edits", () => {
  it("inserts and removes", () => {
    expect(ids(insertAt(abcd, 1, [slide("x")]))).toBe("axbcd");
    expect(ids(removeSlides(abcd, [0, 2]))).toBe("bd");
  });
});

describe("assetNames", () => {
  it("finds images in attributes and styles, once each", () => {
    const withImages = slide(
      "a",
      `<img src="assets/one.png"><i style="background:url(assets/two.jpg)"></i><img src="assets/one.png">`,
    );
    expect(assetNames([withImages])).toEqual(["assets/one.png", "assets/two.jpg"]);
  });

  it("reads names with escaped quotes and ampersands", () => {
    const escaped = slide("a", `<i style="background:url(&quot;assets/a&amp;b.png&quot;)"></i>`);
    expect(assetNames([escaped])).toEqual(["assets/a&b.png"]);
  });
});

describe("renameAssets", () => {
  it("renames an image everywhere it's used, and nothing else", () => {
    const html = `<img src="assets/a.png"><img src="assets/a.png.bak"><i style="background:url(&quot;assets/a.png&quot;)"></i>`;
    const [renamed] = renameAssets([slide("x", html)], [["assets/a.png", "assets/new.png"]]);
    expect(assetNames(renamed ? [renamed] : [])).toEqual(["assets/new.png", "assets/a.png.bak"]);
  });

  it("copes with characters that mean something to a pattern", () => {
    const [renamed] = renameAssets(
      [slide("x", `<img src="assets/a&amp;(1).png">`)],
      [["assets/a&(1).png", "assets/new.png"]],
    );
    expect(renamed?.html).toContain("assets/new.png");
  });
});

describe("wouldHide", () => {
  it("says what Hide is about to do", () => {
    expect(wouldHide(abcd, [0, 1])).toBe(true);
    expect(wouldHide(toggleHidden(abcd, [0]), [0])).toBe(false);
  });
});

describe("nextSelection", () => {
  const plain = { ctrl: false, shift: false };
  it("selects only the clicked slide", () => {
    expect(nextSelection([0, 1], 0, 3, plain)).toEqual([3]);
  });
  it("adds and removes with Ctrl", () => {
    expect(nextSelection([1], 1, 3, { ctrl: true, shift: false })).toEqual([1, 3]);
    expect(nextSelection([1, 3], 1, 3, { ctrl: true, shift: false })).toEqual([1]);
  });
  it("keeps at least one selected", () => {
    expect(nextSelection([1], 1, 1, { ctrl: true, shift: false })).toEqual([1]);
  });
  it("selects a range with Shift, in either direction", () => {
    expect(nextSelection([1], 1, 3, { ctrl: false, shift: true })).toEqual([1, 2, 3]);
    expect(nextSelection([3], 3, 1, { ctrl: false, shift: true })).toEqual([1, 2, 3]);
  });
});
