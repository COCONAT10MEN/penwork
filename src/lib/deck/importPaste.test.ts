// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { deckAccent, deckFacts } from "./facts";
import { importPaste, manifestFor } from "./importPaste";
import { newDeck } from "./layouts";
import { sanitizeSlides } from "./sanitize";

describe("importPaste", () => {
  const reply = `Here are your slides:

\`\`\`html
<section class="slide" data-title="First"><div class="spill"><span class="snm">Optics</span></div></section>
<section class="slide" data-title="Second"></section>
\`\`\`

And some colours:

\`\`\`css
.slide h2{color:red}
\`\`\`

\`\`\`js
W.spin=function(root){};
\`\`\`

\`\`\`js
console.log("not for the deck");
\`\`\`
`;

  it("finds slides, css and widget code among the words of a chat reply", () => {
    const deck = importPaste(reply);
    expect(deck?.title).toBe("Optics");
    expect(sanitizeSlides(deck?.slidesHtml ?? "").slideCount).toBe(2);
    expect(deck?.slidesHtml).not.toContain("Here are your slides");
    expect(deck?.themeCss).toContain(".slide h2{color:red}");
    expect(deck?.themeCss).toContain("--teal");
    expect(deck?.widgetsJs).toContain("W.spin");
    expect(deck?.widgetsJs).not.toContain("console.log");
  });

  it("leaves unsafe slides for the sanitiser to clean", () => {
    const deck = importPaste(
      '<section class="slide"><img src="x" onerror="boom()"><script>boom()</script></section>',
    );
    const clean = sanitizeSlides(deck?.slidesHtml ?? "");
    expect(clean.html).not.toContain("onerror");
    expect(clean.html).not.toContain("boom");
  });

  it("returns null when there are no slides", () => {
    expect(importPaste("Just some text from the clipboard")).toBeNull();
    expect(importPaste("")).toBeNull();
  });
});

describe("facts", () => {
  it("counts what the cards show and keeps words for search", () => {
    const html = sanitizeSlides(
      `<section class="slide"><h2>Force</h2><div data-w="demo"></div></section>
       <section class="slide"><div class="quiz"><div class="qbox"></div></div></section>`,
    ).html;
    expect(deckFacts(html)).toMatchObject({ quizzes: 1, interactive: true });
    expect(deckFacts(html).text).toContain("Force");
  });

  it("reads the deck's main colour", () => {
    expect(deckAccent(":root{--ink:#111111;--teal:#0AA0C8}")).toBe("#0AA0C8");
    expect(deckAccent("body{color:red}")).toBeNull();
  });
});

describe("newDeck", () => {
  it("builds slides that pass through the sanitiser untouched", () => {
    const clean = sanitizeSlides(newDeck("Waves", "quiz").slidesHtml);
    expect(clean.slideCount).toBe(2);
    expect(clean.removed).toEqual([]);
  });

  it("escapes the name so it can't break out of the slide", () => {
    const deck = newDeck('A "quoted" <b>name</b>', "cover");
    expect(deck.title).toBe('A "quoted" <b>name</b>');
    expect(deck.slidesHtml).toContain("&lt;b&gt;");
    expect(deck.slidesHtml).not.toContain("<b>name");
  });

  it("names an empty deck", () => {
    expect(newDeck("  ", "cover").title).toBe("Untitled deck");
  });
});

describe("manifestFor", () => {
  it("writes a manifest the Rust reader accepts", () => {
    const manifest = manifestFor(newDeck("Waves", "cover"), "test", "2026-10-31T00:00:00Z");
    expect(manifest).toMatchObject({ format: "penwork-deck", version: 1, title: "Waves" });
  });
});
