import { sanitizeSlides } from "./sanitize";

/**
 * Finding and changing one element of a slide's clean HTML. The page numbers every element in
 * document order as it loads, and this counts the same way. The tag is checked as well, so a slide
 * that has moved on since is refused and not edited in the wrong place.
 */
function parse(slide: string): Element | null {
  const page = document.createElement("template");
  page.innerHTML = slide;
  return page.content.firstElementChild;
}

function numbered(root: Element, n: number): Element | null {
  return n === 0 ? root : (root.querySelectorAll("*")[n - 1] ?? null);
}

/** A copy to read from. Changing it changes nothing. */
export function elementAt(slide: string, n: number): Element | null {
  const root = parse(slide);
  return root ? numbered(root, n) : null;
}

/** Everything that comes from the page is untrusted, so the result is sanitised like a new file. */
export function changeElement(
  slide: string,
  n: number,
  tag: string,
  change: (element: Element) => void,
): string | null {
  const root = parse(slide);
  const element = root && numbered(root, n);
  if (!root || !element || element.tagName !== tag) return null;
  change(element);
  return sanitizeSlides(root.outerHTML).html;
}

export function setElementHtml(slide: string, n: number, tag: string, html: string): string | null {
  return changeElement(slide, n, tag, (element) => {
    element.innerHTML = html;
  });
}
