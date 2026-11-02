// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { aiPrompt, readAiReply } from "./askAi";
import { applyBrand, readBrand } from "./brand";
import { readThemeColors, setThemeColors } from "./themeColors";

const COVER = `<section class="slide hero"><div class="kick">Old kicker</div><b class="sv">SESSION</b><b class="sn">1</b><h1 class="snm">Old</h1></section>`;

describe("brand", () => {
  it("reads values from the manifest first, then the slides", () => {
    const slides = [{ id: "a", html: COVER }];
    expect(readBrand({ brand: { badgeNumber: "7" } }, "T", slides)).toEqual({
      word: "SESSION",
      number: "7",
      name: "Old",
      kicker: "Old kicker",
    });
  });

  it("writes them into a slide and leaves the rest alone", () => {
    const next = applyBrand(COVER, { word: "WEEK", number: "2", name: "New", kicker: "K" });
    expect(next).toContain('<b class="sv">WEEK</b>');
    expect(next).toContain('<h1 class="snm">New</h1>');
    expect(next).toContain('<div class="kick">K</div>');
    expect(next).toContain('class="slide hero"');
  });
});

describe("theme colours", () => {
  const css = ":root{\n  --teal:#0aa0c8;\n  --or:#c0562f;\n}\n.mine{color:red}";

  it("changes the colours and keeps the rest of the CSS", () => {
    const next = setThemeColors(css, {
      teal: "#112233",
      or: "#445566",
      ink: "#000000",
      paper: "#ffffff",
    });
    expect(readThemeColors(next).teal).toBe("#112233");
    expect(readThemeColors(next).paper).toBe("#ffffff");
    expect(next).toContain(".mine{color:red}");
  });

  it("doesn't pile up the blob colours when changed twice", () => {
    const colors = readThemeColors(css);
    const twice = setThemeColors(setThemeColors(css, colors), colors);
    expect(twice.match(/colours from Penwork \*\//g)?.length).toBe(2);
  });
});

describe("ask AI", () => {
  it("puts the request and the slide into the prompt", () => {
    const text = aiPrompt({
      request: "Make it two columns",
      title: "Waves",
      slidesHtml: "<section></section>",
      themeCss: ":root{}",
      scope: "this slide",
    });
    expect(text).toContain("Make it two columns");
    expect(text).toContain("<section></section>");
  });

  it("finds slides and colours in a chat reply", () => {
    const reply = readAiReply(
      'Here you go!\n```html\n<section class="slide"><h2>One</h2></section>\n<section class="slide"><h2>Two</h2></section>\n```\n```css\n:root{--teal:#112233}\n```',
    );
    expect(reply.slides).toHaveLength(2);
    expect(reply.css).toContain("--teal");
  });

  it("removes scripts, and refuses styles that reach outside", () => {
    const reply = readAiReply(
      '<section class="slide"><script>bad()</script><h2 onclick="x()">Hi</h2></section>```css\n@import url(http://x.y/z.css);\n```',
    );
    expect(reply.slides[0]).not.toContain("bad()");
    expect(reply.slides[0]).not.toContain("onclick");
    expect(reply.css).toBeNull();
  });
});
