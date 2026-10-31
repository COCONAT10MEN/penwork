/**
 * Turns slides written by an AI into deck parts (docs/DECK-FORMAT.md §7). This is the only way in
 * besides a .pwpptx: Penwork never opens .html files. Nothing here is cleaned, because everything
 * goes through the sanitiser afterwards, like a deck read from a file. <template> only parses:
 * no script runs and nothing loads.
 */

export interface DeckBrand {
  badgeWord?: string;
  badgeNumber?: string;
  deckName?: string;
  kicker?: string;
}

export interface DeckParts {
  title: string;
  lang: string;
  dir: "ltr" | "rtl";
  brand: DeckBrand;
  slidesHtml: string;
  themeCss: string;
  widgetsJs: string;
}

/** The template's own colours, for slides that arrive with no theme of their own. */
export const DEFAULT_THEME = `:root{
  --ink:#0b2a36;
  --navy:#12303d;
  --teal:#0aa0c8;
  --teal2:#0e6f8e;
  --or:#c0562f;
  --cy:#6fd8ee;
  --paper:#f4f9fb;
}
.hero:not(:has(.bg)){background:radial-gradient(1300px 760px at 78% 30%,#0f4a63 0,#07161e 62%,#04090c 100%)}
`;

function textOf(root: ParentNode, selector: string): string | undefined {
  return root.querySelector(selector)?.textContent?.trim() || undefined;
}

function readBrand(root: ParentNode): DeckBrand {
  const brand: DeckBrand = {
    badgeWord: textOf(root, ".sv"),
    badgeNumber: textOf(root, ".sn"),
    deckName: textOf(root, ".snm"),
    kicker: textOf(root, ".kick"),
  };
  return Object.fromEntries(Object.entries(brand).filter(([, v]) => v !== undefined));
}

function hasSlides(html: string): boolean {
  return /<section\b[^>]*\bclass\s*=\s*["'][^"']*\bslide\b/i.test(html);
}

const CSS_BLOCK = /```css[^\n]*\n([\s\S]*?)```/g;
const SCRIPT_BLOCK = /```(?:js|javascript)[^\n]*\n([\s\S]*?)```/g;

/** A chat reply: slides, maybe a ```css block, and the words around them. */
export function importPaste(text: string): DeckParts | null {
  if (!hasSlides(text)) return null;
  const blocks = (pattern: RegExp) => Array.from(text.matchAll(pattern), (m) => m[1] ?? "");
  const css = blocks(CSS_BLOCK);
  // Only widget code. Anything else in a js block isn't meant for the deck.
  const widgets = blocks(SCRIPT_BLOCK).filter((code) => /\bW\.\w+\s*=/.test(code));

  const template = document.createElement("template");
  template.innerHTML = text;
  const slides = Array.from(template.content.querySelectorAll("section.slide"));
  const brand = readBrand(template.content);
  const first = slides[0];
  return {
    title: brand.deckName || first?.getAttribute("data-title") || "Pasted deck",
    lang: "en",
    dir: "ltr",
    brand,
    slidesHtml: slides.map((slide) => slide.outerHTML).join("\n"),
    themeCss: [DEFAULT_THEME, ...css].join("\n"),
    widgetsJs: widgets.join("\n"),
  };
}

export function manifestFor(deck: DeckParts, generator: string, now: string): object {
  return {
    format: "penwork-deck",
    version: 1,
    engine: "lop-1",
    title: deck.title,
    lang: deck.lang,
    dir: deck.dir,
    stage: { w: 1920, h: 1080 },
    brand: deck.brand,
    created: now,
    modified: now,
    generator,
  };
}
