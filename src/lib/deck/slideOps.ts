/**
 * Slides as the editor holds them: the original HTML of each one, never the live page, because the
 * engine rewrites the live page as it runs (docs/ARCHITECTURE-DECKS.md §3). Every function returns
 * a new list, so undo can keep the old one as it is.
 */

export interface DeckSlide {
  id: string;
  html: string;
  notes?: string;
}

/** The most Penwork opens (docs/DECK-FORMAT.md), so the most it may save. */
export const MAX_SLIDES = 500;

function parsed(html: string): DocumentFragment {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content;
}

function firstSection(html: string): Element | null {
  return parsed(html).querySelector("section.slide");
}

export function splitSlides(html: string): DeckSlide[] {
  return Array.from(parsed(html).querySelectorAll("section.slide"), (el) => ({
    id: el.getAttribute("data-id") ?? "",
    html: el.outerHTML,
  }));
}

export function joinSlides(slides: readonly DeckSlide[]): string {
  return slides.map((slide) => slide.html).join("\n");
}

export function newSlideId(): string {
  return `s-${Math.random().toString(36).slice(2, 10).padEnd(8, "0")}`;
}

/** A copy of a slide needs an id of its own: ink and notes are keyed by it. */
export function withNewId(slide: DeckSlide): DeckSlide {
  const el = firstSection(slide.html);
  if (!el) return slide;
  const id = newSlideId();
  el.setAttribute("data-id", id);
  return { ...slide, id, html: el.outerHTML };
}

/** Where a show from the start begins. */
export function firstShown(slides: readonly DeckSlide[]): number {
  return Math.max(
    0,
    slides.findIndex((slide) => !isHidden(slide)),
  );
}

/** notes.json: speaker notes by slide id. */
export function withNotes(slides: DeckSlide[], notes: unknown): DeckSlide[] {
  if (typeof notes !== "object" || notes === null) return slides;
  const byId = notes as Record<string, unknown>;
  return slides.map((slide) => {
    const text = slide.id ? byId[slide.id] : undefined;
    return typeof text === "string" ? { ...slide, notes: text } : slide;
  });
}

export function notesOf(slides: readonly DeckSlide[]): Record<string, string> | null {
  const notes = Object.fromEntries(
    slides.flatMap((s) => (s.notes && s.id ? [[s.id, s.notes] as const] : [])),
  );
  return Object.keys(notes).length > 0 ? notes : null;
}

export function isHidden(slide: DeckSlide): boolean {
  return firstSection(slide.html)?.getAttribute("data-hidden") === "true";
}

function setHiddenOn(slide: DeckSlide, hidden: boolean): DeckSlide {
  const el = firstSection(slide.html);
  if (!el) return slide;
  if (hidden) el.setAttribute("data-hidden", "true");
  else el.removeAttribute("data-hidden");
  return { ...slide, html: el.outerHTML };
}

export function insertAt(
  slides: readonly DeckSlide[],
  index: number,
  added: readonly DeckSlide[],
): DeckSlide[] {
  return [...slides.slice(0, index), ...added, ...slides.slice(index)];
}

export function removeSlides(slides: readonly DeckSlide[], picked: readonly number[]): DeckSlide[] {
  const gone = new Set(picked);
  return slides.filter((_, i) => !gone.has(i));
}

/** Hide hides them, unless they're all hidden already: then it shows them again. */
export function wouldHide(slides: readonly DeckSlide[], picked: readonly number[]): boolean {
  return picked.some((i) => {
    const slide = slides[i];
    return slide !== undefined && !isHidden(slide);
  });
}

export function toggleHidden(slides: readonly DeckSlide[], picked: readonly number[]): DeckSlide[] {
  const hide = wouldHide(slides, picked);
  const chosen = new Set(picked);
  return slides.map((slide, i) => (chosen.has(i) ? setHiddenOn(slide, hide) : slide));
}

/**
 * Moves the picked slides, keeping their order, so they land before the slide now at `to`.
 * `to` can equal the length, for the end. Returns where the first of them ended up.
 */
export function moveSlides(
  slides: readonly DeckSlide[],
  picked: readonly number[],
  to: number,
): { slides: DeckSlide[]; first: number } {
  const chosen = new Set(picked);
  const moving = slides.filter((_, i) => chosen.has(i));
  const rest = slides.filter((_, i) => !chosen.has(i));
  const before = slides.slice(0, to).filter((_, i) => !chosen.has(i)).length;
  return { slides: insertAt(rest, before, moving), first: before };
}

/** The picked slides, as one block one place up or down. */
export function nudgeSlides(
  slides: readonly DeckSlide[],
  picked: readonly number[],
  direction: -1 | 1,
): { slides: DeckSlide[]; first: number } | null {
  const sorted = [...picked].sort((a, b) => a - b);
  const low = sorted[0];
  const high = sorted[sorted.length - 1];
  if (low === undefined || high === undefined) return null;
  if (direction < 0 ? low === 0 : high === slides.length - 1) return null;
  return moveSlides(slides, sorted, direction < 0 ? low - 1 : high + 2);
}

/** A style attribute comes back from the browser with its quotes written as &quot;. */
function plainQuotes(html: string): string {
  return html.replaceAll("&quot;", '"').replaceAll("&#39;", "'").replaceAll("&amp;", "&");
}

/** The deck images a slide uses, so that a copy can take them along. */
export function assetNames(slides: readonly DeckSlide[]): string[] {
  const names = new Set<string>();
  for (const slide of slides) {
    for (const match of plainQuotes(slide.html).matchAll(/["'(](assets\/[^"')]+)["')]/g)) {
      if (match[1]) names.add(match[1]);
    }
  }
  return [...names];
}

/** Points slides at new image names, for an image that clashed with one already in the deck. */
export function renameAssets(
  slides: readonly DeckSlide[],
  renames: readonly (readonly [string, string])[],
): DeckSlide[] {
  return slides.map((slide) => ({
    ...slide,
    html: renames.reduce((html, [from, to]) => {
      const name = from.replaceAll("&", "&amp;").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return html.replace(new RegExp(`${name}(?=["')&])`, "g"), () => to);
    }, slide.html),
  }));
}

/** What the slide list selects after a click, with Ctrl and Shift as in any file list. */
export function nextSelection(
  selected: readonly number[],
  current: number,
  clicked: number,
  keys: { ctrl: boolean; shift: boolean },
): number[] {
  if (keys.shift) {
    const from = Math.min(current, clicked);
    const to = Math.max(current, clicked);
    return Array.from({ length: to - from + 1 }, (_, i) => from + i);
  }
  if (!keys.ctrl) return [clicked];
  if (!selected.includes(clicked)) return [...selected, clicked].sort((a, b) => a - b);
  return selected.length > 1 ? selected.filter((i) => i !== clicked) : [...selected];
}
