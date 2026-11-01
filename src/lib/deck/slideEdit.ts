import { sanitizeSlides } from "./sanitize";

/**
 * Changes one element of a slide's clean HTML. The page numbers every element in document order as
 * it loads, and this counts the same way. The tag is checked as well, so a slide that has moved on
 * since is refused and not edited in the wrong place. Everything from the page is untrusted, so the
 * result goes through the same sanitiser as a file being opened.
 */
export function setElementHtml(slide: string, n: number, tag: string, html: string): string | null {
  const page = document.createElement("template");
  page.innerHTML = slide;
  const root = page.content.firstElementChild;
  if (!root) return null;
  const element = n === 0 ? root : root.querySelectorAll("*")[n - 1];
  if (!element || element.tagName !== tag) return null;
  element.innerHTML = html;
  return sanitizeSlides(page.innerHTML).html;
}
