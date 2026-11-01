import DOMPurify from "dompurify";

/**
 * Cleans slide HTML (docs/DECK-FORMAT.md §4). The sandbox is what keeps a deck contained; this
 * keeps files clean and the app's own UI safe when it shows slide text. Pure, so it can be tested.
 */

export interface SanitizeResult {
  html: string;
  /** Short names of what was removed, for the "Cleaned up while opening" note. */
  removed: string[];
  slideCount: number;
}

// Links may only point inside the deck: anything else could reach outside it.
const ALLOWED_LINK = /^(?:assets\/|#|data:image\/)/i;
// DOMPurify tests most attribute values against this, not only links, so it must let ordinary
// values through (a viewBox, a width). Strict link checking is the hook in sanitizeSlides.
const NO_FOREIGN_SCHEME = /^(?!\s*[a-z][a-z0-9+.-]*:)|^data:image\//i;
const LINK_ATTRIBUTES = new Set(["src", "href", "xlink:href"]);

const FORBID_TAGS = ["form", "iframe", "object", "embed", "link", "meta", "base", "style"];

/** Parsed but inert: nothing in a <template> loads or runs. */
function parsed(html: string): DocumentFragment {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content;
}

/** How many of each tag and attribute name there are. Comments don't count. */
function inventory(root: DocumentFragment): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (name: string) => counts.set(name, (counts.get(name) ?? 0) + 1);
  for (const el of root.querySelectorAll("*")) {
    add(el.nodeName.toLowerCase());
    for (const attr of Array.from(el.attributes)) add(attr.name);
  }
  return counts;
}

/** From the slide's content, so a slide with no id gets the same one each time: ink is keyed by it. */
function newSlideId(html: string, taken: Set<string>): string {
  for (let salt = 0; ; salt++) {
    let hash = 0x811c9dc5 ^ salt;
    for (let i = 0; i < html.length; i++) hash = Math.imul(hash ^ html.charCodeAt(i), 0x01000193);
    const id = `s-${(hash >>> 0).toString(36).padStart(8, "0")}`;
    if (!taken.has(id)) return id;
  }
}

function cleanInline(text: string): string {
  return DOMPurify.sanitize(text, { ALLOWED_URI_REGEXP: NO_FOREIGN_SCHEME, FORBID_TAGS });
}

interface QuizQuestion {
  q?: unknown;
  o?: unknown;
  e?: unknown;
}

/** The engine inserts quiz text as HTML, and the main pass can't see inside JSON. */
function cleanQuiz(script: Element, removed: string[]): void {
  let data: unknown;
  try {
    data = JSON.parse(script.textContent ?? "");
  } catch {
    script.remove();
    removed.push("broken quiz data");
    return;
  }
  if (!Array.isArray(data)) {
    script.remove();
    removed.push("broken quiz data");
    return;
  }
  let changed = false;
  const clean = (value: unknown): unknown => {
    if (typeof value !== "string") return value;
    const out = cleanInline(value);
    // The browser rewrites harmless text ("a &lt; b"), so compare as parsed, not as strings.
    const probe = document.createElement("template");
    probe.innerHTML = value;
    if (probe.innerHTML !== out) changed = true;
    return out;
  };
  const cleaned = (data as QuizQuestion[]).map((question) => ({
    ...question,
    q: clean(question.q),
    o: Array.isArray(question.o) ? question.o.map(clean) : question.o,
    e: clean(question.e),
  }));
  if (changed) {
    script.textContent = JSON.stringify(cleaned).replace(/<\//g, "<\\/");
    removed.push("unsafe quiz text");
  }
}

export function sanitizeSlides(input: string): SanitizeResult {
  const removed: string[] = [];

  const isQuizData = (el: Element) =>
    el.nodeName === "SCRIPT" &&
    el.getAttribute("type") === "application/json" &&
    el.closest(".quiz") !== null;

  // The one script allowed in a slide: quiz data, which is JSON and never runs.
  DOMPurify.addHook("uponSanitizeElement", (node, data) => {
    if (data.tagName === "script" && !isQuizData(node as Element)) (node as Element).remove();
  });
  DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
    if (data.attrName === "type" && isQuizData(node)) data.forceKeepAttr = true;
    if (LINK_ATTRIBUTES.has(data.attrName) && !ALLOWED_LINK.test(data.attrValue.trim())) {
      data.keepAttr = false;
    }
  });

  const fragment = DOMPurify.sanitize(input, {
    ADD_TAGS: ["script"],
    FORBID_TAGS,
    ALLOW_DATA_ATTR: true,
    ALLOWED_URI_REGEXP: NO_FOREIGN_SCHEME,
    // These guard XML output. Slides are HTML, and quiz JSON legitimately contains tags.
    SAFE_FOR_XML: false,
    RETURN_DOM_FRAGMENT: true,
    FORCE_BODY: true,
  });

  DOMPurify.removeAllHooks();

  // DOMPurify.removed also lists its internal steps, so compare what went in with what came out.
  const before = inventory(parsed(input));
  const after = inventory(fragment);
  for (const [name, count] of before) {
    if ((after.get(name) ?? 0) < count) removed.push(name);
  }

  const slides: Element[] = [];
  for (const child of Array.from(fragment.children)) {
    if (child.matches("section.slide")) slides.push(child);
    else removed.push(`${child.nodeName.toLowerCase()} outside a slide`);
  }

  const seen = new Set<string>();
  for (const slide of slides) {
    // Notes, ink and thumbnails are keyed by this id, so an existing one is never changed.
    let id = slide.getAttribute("data-id");
    if (!id || seen.has(id)) {
      id = newSlideId(slide.outerHTML, seen);
      slide.setAttribute("data-id", id);
    }
    seen.add(id);
    slide.querySelectorAll('script[type="application/json"]').forEach((s) => cleanQuiz(s, removed));
  }

  return {
    html: slides.map((slide) => slide.outerHTML).join("\n"),
    removed: [...new Set(removed)],
    slideCount: slides.length,
  };
}
