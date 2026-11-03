/**
 * Zooming changes every page's size at once, which looks like a jump. These measure the page in
 * view, let the change happen, then animate the pages from where they were to where they are: the
 * "first, last, invert, play" way, so the browser moves one picture instead of redrawing.
 */

type Motion = "spatial-default" | "effects-slow";

function anchor(box: HTMLElement, page: number): HTMLElement | null {
  return box.querySelector<HTMLElement>(`.page[data-page-number="${page}"]`);
}

/** Where the page in view is now, before something changes it. */
export function measurePage(box: HTMLElement, page: number): DOMRect | null {
  return anchor(box, page)?.getBoundingClientRect() ?? null;
}

/** Animates the pages from `before` to wherever they are now. */
export function playFrom(
  box: HTMLElement,
  page: number,
  before: DOMRect | null,
  motion: Motion = "spatial-default",
): void {
  const viewer = box.querySelector<HTMLElement>(".pdfViewer");
  const after = anchor(box, page)?.getBoundingClientRect();
  const reduce =
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.hasAttribute("data-reduce-motion");
  if (!viewer || !before || !after || after.width === 0 || reduce) return;
  const scale = before.width / after.width;
  const dx = before.left - after.left;
  const dy = before.top - after.top;
  if (Math.abs(scale - 1) < 0.002 && Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
  const frame = viewer.getBoundingClientRect();
  const origin = `${after.left - frame.left}px ${after.top - frame.top}px`;
  const tokens = getComputedStyle(document.documentElement);
  const duration = parseFloat(tokens.getPropertyValue(`--md-sys-motion-${motion}-duration`));
  const easing = tokens.getPropertyValue(`--md-sys-motion-${motion}-easing`).trim();
  viewer.animate(
    [
      { transformOrigin: origin, transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
      { transformOrigin: origin, transform: "none" },
    ],
    { duration: duration || 500, easing: easing || "ease-out" },
  );
}

/** Measure, change, animate, all at once. */
export function flipViewer(box: HTMLElement, page: number, change: () => void): void {
  const before = measurePage(box, page);
  change();
  playFrom(box, page, before);
}
