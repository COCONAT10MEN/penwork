// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { deckAccent, deckFacts } from "./facts";
import { manifestFor } from "./deckParts";
import { newDeck } from "./layouts";
import { sanitizeSlides } from "./sanitize";

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
    expect(newDeck("  ", "cover").title).toBe("Untitled presentation");
  });
});

describe("manifestFor", () => {
  it("writes a manifest the Rust reader accepts", () => {
    const manifest = manifestFor(newDeck("Waves", "cover"), "test", "2026-10-31T00:00:00Z");
    expect(manifest).toMatchObject({ format: "penwork-deck", version: 1, title: "Waves" });
  });
});
