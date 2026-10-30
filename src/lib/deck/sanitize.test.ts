// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import template from "../../../reference/lop-deck/deck-template.html?raw";
import { sanitizeSlides } from "./sanitize";

const demo = template.slice(
  template.indexOf("<!-- SLIDES:START"),
  template.indexOf("<!-- SLIDES:END -->"),
);

const slide = (body: string) => `<section class="slide" data-id="s-aaaaaaaa">${body}</section>`;

function parse(html: string): HTMLElement {
  const box = document.createElement("div");
  box.innerHTML = html;
  return box;
}

describe("the demo deck", () => {
  it("passes through with nothing removed and nothing lost", () => {
    const result = sanitizeSlides(demo);
    expect(result.removed).toEqual([]);
    expect(result.slideCount).toBe(8);

    const before = parse(demo);
    const after = parse(result.html);
    for (const selector of [
      ".st",
      ".tex",
      ".card",
      ".svgbox",
      "svg",
      "[data-m]",
      "[data-hl]",
      "[data-part]",
      "[data-w]",
      "[data-bg]",
      ".fbox",
      "table",
      ".quiz script",
      "svg[viewBox]",
      "line[x1][stroke-width]",
      "text[font-size]",
    ]) {
      expect(after.querySelectorAll(selector).length, selector).toBe(
        before.querySelectorAll(selector).length,
      );
    }
    expect(after.querySelector("[data-m]")?.getAttribute("data-m")).toBe("sdot");
  });

  it("keeps the quiz JSON readable", () => {
    const after = parse(sanitizeSlides(demo).html);
    const script = after.querySelector(".quiz script");
    expect(script?.getAttribute("type")).toBe("application/json");
    const questions = JSON.parse(script?.textContent ?? "") as { o: string[] }[];
    expect(questions[0]?.o.length).toBeGreaterThan(1);
  });

  it("keeps inline style variables", () => {
    const out = sanitizeSlides(slide('<div class="cols" style="--c:780px">x</div>')).html;
    expect(out).toContain("--c:780px");
  });
});

describe("what must go", () => {
  const cases: [string, string, string][] = [
    ["a script", slide("<script>alert(1)</script>"), "alert"],
    [
      "a script outside quiz, even JSON",
      slide('<script type="application/json">[]</script>'),
      "<script",
    ],
    ["an event handler", slide('<img src="assets/a.png" onerror="alert(1)">'), "onerror"],
    ["a javascript link", slide('<a href="javascript:alert(1)">x</a>'), "javascript:"],
    ["an internet image", slide('<img src="https://example.com/x.png">'), "example.com"],
    ["an iframe", slide('<iframe src="assets/a.html"></iframe>'), "<iframe"],
    ["a form", slide("<form><input></form>"), "<form"],
    ["a link tag", slide('<link rel="stylesheet" href="https://example.com/a.css">'), "<link"],
    ["a style tag", slide("<style>body{display:none}</style>"), "<style"],
    ["an svg script", slide("<svg><script>alert(1)</script></svg>"), "alert"],
    ["an svg event", slide('<svg onload="alert(1)"></svg>'), "onload"],
  ];
  for (const [name, input, banned] of cases) {
    it(`removes ${name} and reports it`, () => {
      const result = sanitizeSlides(input);
      expect(result.html).not.toContain(banned);
      expect(result.removed.length).toBeGreaterThan(0);
      expect(result.slideCount).toBe(1);
    });
  }

  it("removes links that point anywhere but the deck", () => {
    for (const src of ["other.png", "../x.png", "//example.com/x.png", "data:text/html,x"]) {
      const out = sanitizeSlides(slide(`<img src="${src}">`));
      expect(out.html, src).not.toContain(src);
      expect(out.removed, src).toContain("src");
    }
  });

  it("keeps what is allowed", () => {
    const out = sanitizeSlides(
      slide('<img src="assets/a.png"><img src="data:image/png;base64,AAAA"><a href="#x">y</a>'),
    );
    expect(out.removed).toEqual([]);
    expect(out.html).toContain('src="assets/a.png"');
    expect(out.html).toContain("data:image/png");
  });

  it("drops anything outside a slide", () => {
    const out = sanitizeSlides(`<p>loose</p>${slide("kept")}`);
    expect(out.html).not.toContain("loose");
    expect(out.slideCount).toBe(1);
    expect(out.removed).toContain("p outside a slide");
  });

  it("cleans HTML hidden inside quiz JSON", () => {
    const quiz = JSON.stringify([
      { q: '<img src=x onerror="alert(1)">Q', o: ["A", "B"], a: 0, e: "E" },
    ]);
    const out = sanitizeSlides(
      slide(`<div class="quiz"><script type="application/json">${quiz}</script></div>`),
    );
    expect(out.html).not.toContain("onerror");
    expect(out.removed).toContain("unsafe quiz text");
  });

  it("removes quiz data that isn't valid JSON", () => {
    const out = sanitizeSlides(
      slide('<div class="quiz"><script type="application/json">{nope</script></div>'),
    );
    expect(out.html).not.toContain("<script");
    expect(out.removed).toContain("broken quiz data");
  });
});

describe("slide ids", () => {
  it("adds a missing id and never changes an existing one", () => {
    const out = parse(
      sanitizeSlides(`${slide("a")}<section class="slide">b</section>`).html,
    ).querySelectorAll("section");
    expect(out[0]?.getAttribute("data-id")).toBe("s-aaaaaaaa");
    expect(out[1]?.getAttribute("data-id")).toMatch(/^s-[a-z0-9]{8}$/);
  });

  it("gives a duplicate id a new one", () => {
    const out = parse(sanitizeSlides(slide("a") + slide("b")).html).querySelectorAll("section");
    expect(out[0]?.getAttribute("data-id")).not.toBe(out[1]?.getAttribute("data-id"));
  });

  it("keeps hidden slides hidden", () => {
    const out = sanitizeSlides('<section class="slide" data-hidden="true">x</section>');
    expect(out.html).toContain('data-hidden="true"');
  });
});
