import { fileTitle } from "./manifest";

/**
 * Turns the other ways a deck arrives into deck parts (docs/DECK-FORMAT.md §7). Nothing here is
 * cleaned: everything goes through the sanitiser afterwards, like a deck read from a file.
 * DOMParser and <template> only parse: no script runs and nothing loads.
 */

export interface DeckBrand {
  badgeWord?: string;
  badgeNumber?: string;
  deckName?: string;
  kicker?: string;
}

export interface ImportedDeck {
  title: string;
  lang: string;
  dir: "ltr" | "rtl";
  brand: DeckBrand;
  slidesHtml: string;
  themeCss: string;
  widgetsJs: string;
  /** Things worth telling the user about the import. */
  notes: string[];
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

const SLIDES_START = /<!--\s*SLIDES:START[\s\S]*?-->/;
const SLIDES_END = "<!-- SLIDES:END -->";
const QUIZ_MARKER = "/* ---- quiz ---- */";
const WIDGETS_START = "var W={};";
// The last of the engine's own helpers. Widget code starts after it.
const LAST_HELPER = /function mi\(t\)\{[^\n]*\n/;

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

/** Slides as the source wrote them, so comments and spacing inside them survive. */
function sectionsOf(html: string): string {
  const start = html.match(SLIDES_START);
  const end = html.indexOf(SLIDES_END);
  if (start?.index !== undefined && end > start.index) {
    return html.slice(start.index + start[0].length, end).trim();
  }
  const template = document.createElement("template");
  template.innerHTML = html;
  const slides = Array.from(template.content.querySelectorAll("section.slide"));
  return slides.map((slide) => slide.outerHTML).join("\n");
}

/** Everything between the engine's helpers and its quiz code is the deck's own widget code. */
function widgetCode(html: string): string | null {
  const end = html.indexOf(QUIZ_MARKER);
  const open = html.lastIndexOf(WIDGETS_START, end);
  if (end < 0 || open < 0) return null;
  const region = html.slice(open + WIDGETS_START.length, end);
  const helper = region.match(LAST_HELPER);
  const from = helper?.index === undefined ? 0 : helper.index + helper[0].length;
  return region.slice(from).trim();
}

function languageOf(doc: Document): { lang: string; dir: "ltr" | "rtl" } {
  const root = doc.documentElement;
  return {
    lang: root.getAttribute("lang") || "en",
    dir: root.getAttribute("dir") === "rtl" ? "rtl" : "ltr",
  };
}

function hasSlides(html: string): boolean {
  return /<section\b[^>]*\bclass\s*=\s*["'][^"']*\bslide\b/i.test(html);
}

/** A whole page from the template, or a file holding only slides. Null when it's neither. */
export function importHtml(html: string, path: string): ImportedDeck | null {
  if (!hasSlides(html)) return null;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const slidesHtml = sectionsOf(html);
  const slides = document.createElement("template");
  slides.innerHTML = slidesHtml;
  const brand = readBrand(slides.content);
  const notes: string[] = [];

  const theme = doc.getElementById("theme");
  const widgets = widgetCode(html);
  // <title> is "Deck — Course" in the template, and the deck's name is the first part.
  const pageTitle = doc.title.split(" — ")[0]?.trim();
  const isFullPage = theme !== null;
  if (isFullPage && widgets === null && slidesHtml.includes("data-w=")) {
    notes.push("widget code couldn't be read");
  }
  return {
    title: brand.deckName || pageTitle || fileTitle(path),
    ...languageOf(doc),
    brand,
    slidesHtml,
    themeCss: theme?.textContent ?? DEFAULT_THEME,
    widgetsJs: widgets ?? "",
    notes,
  };
}

const CSS_BLOCK = /```css[^\n]*\n([\s\S]*?)```/g;
const SCRIPT_BLOCK = /```(?:js|javascript)[^\n]*\n([\s\S]*?)```/g;

/** A chat reply: slides, maybe a ```css block, and the words around them. */
export function importPaste(text: string): ImportedDeck | null {
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
    notes: [],
  };
}

export function manifestFor(deck: ImportedDeck, generator: string, now: string): object {
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
