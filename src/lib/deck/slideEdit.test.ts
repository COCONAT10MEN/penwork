// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { setElementHtml } from "./slideEdit";

const SLIDE = `<section class="slide" data-id="a"><h2>Old title</h2><div class="card"><p>One</p></div></section>`;

describe("setElementHtml", () => {
  it("changes only the element named", () => {
    const next = setElementHtml(SLIDE, 1, "H2", "New <b>title</b>");
    expect(next).toContain("<h2>New <b>title</b></h2>");
    expect(next).toContain("<p>One</p>");
    expect(next).toContain('data-id="a"');
  });

  it("counts elements in document order", () => {
    expect(setElementHtml(SLIDE, 3, "P", "Two")).toContain("<p>Two</p>");
  });

  it("refuses an element that isn't what the page thought it was", () => {
    expect(setElementHtml(SLIDE, 1, "P", "Two")).toBeNull();
    expect(setElementHtml(SLIDE, 99, "P", "Two")).toBeNull();
  });

  it("removes anything unsafe the page sends", () => {
    const next = setElementHtml(
      SLIDE,
      3,
      "P",
      `Hi<img src=x onerror="alert(1)"><script>bad()</script>`,
    );
    expect(next).not.toContain("onerror");
    expect(next).not.toContain("bad()");
  });
});
